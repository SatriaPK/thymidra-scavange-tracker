'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { firstIssue, go } from '@/lib/flash';
import { generateAccessCode } from '@/lib/codes';
import { formatCharId, formatItemId } from '@/lib/ids';
import { missingItemRefs, parseItemsImport, parseZonesImport } from '@/lib/transfer';

const MAX_IMPORT_BYTES = 1_000_000;

const uuid = z.string().uuid();
const raw = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;
const idsOf = (fd: FormData) => fd.getAll('ids').map(String).filter((v) => uuid.safeParse(v).success);

const emptyToZero = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : v);
const intField = (min: number, max: number) => z.preprocess(emptyToZero, z.coerce.number().int().min(min).max(max));
const reqInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

type Table = 'item' | 'zone' | 'character';
type NoColumn = 'item_no' | 'zone_no' | 'char_no';

/** Nomor tertinggi yang sudah dipakai di campaign (0 bila belum ada). */
async function maxNo(table: Table, col: NoColumn, campaignId: string): Promise<number> {
  const { data } = await db()
    .from(table)
    .select(col)
    .eq('campaign_id', campaignId)
    .order(col, { ascending: false })
    .limit(1);
  const row = (data?.[0] ?? null) as Record<string, number> | null;
  return row ? row[col] : 0;
}

/** Baca file JSON dari form upload. Mengalihkan ke `back` dengan pesan bila gagal. */
async function readJsonUpload(formData: FormData, back: string): Promise<unknown> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) go(back, 'error', 'Choose a JSON file first.');
  if (file.size > MAX_IMPORT_BYTES) go(back, 'error', 'File is too large (max 1 MB).');
  try {
    return JSON.parse(await file.text());
  } catch {
    go(back, 'error', 'File is not valid JSON.');
  }
}

function importErrors(errors: string[]): string {
  const shown = errors.slice(0, 3).join(' | ');
  return errors.length > 3 ? `${shown} (+${errors.length - 3} more)` : shown;
}

// ======================= Item =======================

const itemSchema = z.object({
  category: z.enum(['junk', 'wondrous']),
  name: z.string().trim().min(1, 'is required').max(80),
  slot_weight: intField(0, 99),
  yield_bio: intField(0, 99),
  yield_arcane: intField(0, 99),
  yield_mech: intField(0, 99),
  yield_ferrous: intField(0, 99),
  description: z.string().trim().max(500).optional(),
});

export async function saveItem(formData: FormData) {
  const campaign = await requireDm();
  const id = String(formData.get('id') ?? '');
  const back = id ? `/dm/items/${id}` : '/dm/items/new';

  const parsed = itemSchema.safeParse(raw(formData));
  if (!parsed.success) go(back, 'error', firstIssue(parsed.error));
  const d = parsed.data;
  const wondrous = d.category === 'wondrous';

  // Wondrous: tanpa slot dan tanpa yield.
  const row = {
    name: d.name,
    description: d.description || null,
    is_wondrous: wondrous,
    slot_weight: wondrous ? 0 : d.slot_weight,
    yield_bio: wondrous ? 0 : d.yield_bio,
    yield_arcane: wondrous ? 0 : d.yield_arcane,
    yield_mech: wondrous ? 0 : d.yield_mech,
    yield_ferrous: wondrous ? 0 : d.yield_ferrous,
  };
  if (!wondrous && row.yield_bio + row.yield_arcane + row.yield_mech + row.yield_ferrous === 0) {
    go(back, 'error', 'A junk item needs at least 1 yield above 0. Use Wondrous Item for items without yield.');
  }

  const result = id
    ? await db().from('item').update(row).eq('id', id).eq('campaign_id', campaign.id)
    : await db()
        .from('item')
        .insert({ ...row, campaign_id: campaign.id, item_no: (await maxNo('item', 'item_no', campaign.id)) + 1 });
  if (result.error) go(back, 'error', 'Could not save the item.');

  revalidatePath('/dm/items');
  go('/dm/items', 'ok', `Item "${row.name}" saved.`);
}

export async function deleteItems(formData: FormData) {
  const campaign = await requireDm();
  const ids = idsOf(formData);
  if (ids.length === 0) go('/dm/items', 'error', 'No items selected.');

  let deleted = 0;
  let blocked = 0;
  for (const id of ids) {
    const { error } = await db().from('item').delete().eq('id', id).eq('campaign_id', campaign.id);
    // holding.item_id memakai "on delete restrict": item yang dimiliki pemain tidak bisa dihapus.
    if (error) blocked++;
    else deleted++;
  }
  revalidatePath('/dm/items');
  if (blocked > 0) {
    go('/dm/items', 'error', `${deleted} deleted. ${blocked} could not be deleted because players still hold them.`);
  }
  go('/dm/items', 'ok', `${deleted} item${deleted === 1 ? '' : 's'} deleted.`);
}

export async function importItems(formData: FormData) {
  const campaign = await requireDm();
  const back = '/dm/items';
  const parsed = parseItemsImport(await readJsonUpload(formData, back));
  if (!parsed.ok) go(back, 'error', importErrors(parsed.errors));

  const { data: existing } = await db().from('item').select('item_no').eq('campaign_id', campaign.id);
  const existingNos = new Set((existing ?? []).map((r) => (r as { item_no: number }).item_no));
  let next = Math.max(0, ...existingNos, ...parsed.rows.map((r) => r.no ?? 0));

  const rows = parsed.rows.map((r) => ({
    campaign_id: campaign.id,
    item_no: r.no ?? ++next,
    name: r.name,
    is_wondrous: r.is_wondrous,
    slot_weight: r.slot_weight,
    yield_bio: r.yield_bio,
    yield_arcane: r.yield_arcane,
    yield_mech: r.yield_mech,
    yield_ferrous: r.yield_ferrous,
    description: r.description,
  }));

  const { error } = await db().from('item').upsert(rows, { onConflict: 'campaign_id,item_no' });
  if (error) go(back, 'error', 'Import failed. No items were changed.');

  const created = rows.filter((r) => !existingNos.has(r.item_no)).length;
  revalidatePath(back);
  go(back, 'ok', `Import done: ${created} new, ${rows.length - created} updated.`);
}

// ======================= Zona =======================

const poolRow = z.object({ item_id: uuid, weight: reqInt(1, 9999) });
const zonePayload = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'is required').max(60),
  dc: reqInt(1, 40),
  junk: z.array(poolRow).max(2000),
  rare: z.array(poolRow).max(2000),
});

interface PoolEntry {
  item_id: string;
  weight: number;
}

/**
 * Samakan isi zone_item dengan daftar baru. Tambah/ubah dulu, baru hapus yang sudah tidak ada,
 * supaya kegagalan di tengah jalan tidak mengosongkan zona.
 */
async function syncZoneItems(zoneId: string, junk: PoolEntry[], rare: PoolEntry[]): Promise<boolean> {
  const wanted = new Map<string, { item_id: string; weight: number; is_rare: boolean }>();
  for (const e of junk) wanted.set(`${e.item_id}:0`, { ...e, is_rare: false });
  for (const e of rare) wanted.set(`${e.item_id}:1`, { ...e, is_rare: true });

  if (wanted.size > 0) {
    const rows = [...wanted.values()].map((r) => ({ zone_id: zoneId, ...r }));
    const { error } = await db().from('zone_item').upsert(rows, { onConflict: 'zone_id,item_id,is_rare' });
    if (error) return false;
  }

  const { data: current } = await db().from('zone_item').select('item_id,is_rare').eq('zone_id', zoneId);
  for (const c of (current ?? []) as { item_id: string; is_rare: boolean }[]) {
    if (!wanted.has(`${c.item_id}:${c.is_rare ? 1 : 0}`)) {
      await db().from('zone_item').delete().eq('zone_id', zoneId).eq('item_id', c.item_id).eq('is_rare', c.is_rare);
    }
  }
  return true;
}

export async function saveZone(formData: FormData) {
  const campaign = await requireDm();

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get('payload') ?? ''));
  } catch {
    go('/dm/zones', 'error', 'Invalid form data. Reload the page and try again.');
  }
  const idHint = (input as { id?: unknown } | null)?.id;
  const back = typeof idHint === 'string' && uuid.safeParse(idHint).success ? `/dm/zones/${idHint}/edit` : '/dm/zones/new';

  const parsed = zonePayload.safeParse(input);
  if (!parsed.success) go(back, 'error', `${firstIssue(parsed.error)} (weights must be 1 or more)`);
  const z = parsed.data;

  // Semua item harus milik campaign ini.
  const itemIds = [...new Set([...z.junk, ...z.rare].map((p) => p.item_id))];
  if (itemIds.length > 0) {
    const { data } = await db().from('item').select('id,is_wondrous').eq('campaign_id', campaign.id).in('id', itemIds);
    const found = (data ?? []) as { id: string; is_wondrous: boolean }[];
    if (found.length !== itemIds.length) go(back, 'error', 'Some items no longer exist. Reload the page.');
    const wondrous = new Map(found.map((r) => [r.id, r.is_wondrous]));
    if (z.junk.some((p) => wondrous.get(p.item_id))) go(back, 'error', 'Junk pool cannot contain Wondrous items.');
    if (z.rare.some((p) => !wondrous.get(p.item_id))) go(back, 'error', 'Rare pool can only contain Wondrous items.');
  }

  let zoneId = z.id ?? '';
  if (zoneId) {
    const { error } = await db()
      .from('zone')
      .update({ name: z.name, dc: z.dc })
      .eq('id', zoneId)
      .eq('campaign_id', campaign.id);
    if (error) go(back, 'error', 'Could not save the zone.');
  } else {
    const { data, error } = await db()
      .from('zone')
      .insert({
        campaign_id: campaign.id,
        zone_no: (await maxNo('zone', 'zone_no', campaign.id)) + 1,
        name: z.name,
        dc: z.dc,
      })
      .select('id')
      .single();
    if (error || !data) go(back, 'error', 'Could not create the zone.');
    zoneId = data.id as string;
  }

  if (!(await syncZoneItems(zoneId, z.junk, z.rare))) {
    go(`/dm/zones/${zoneId}/edit`, 'error', 'Zone saved, but its items could not be saved. Try again.');
  }

  revalidatePath('/dm/zones');
  revalidatePath('/dm');
  go('/dm/zones', 'ok', `Zone "${z.name}" saved.`);
}

export async function deleteZones(formData: FormData) {
  const campaign = await requireDm();
  const ids = idsOf(formData);
  if (ids.length === 0) go('/dm/zones', 'error', 'No zones selected.');
  await db().from('zone').delete().eq('campaign_id', campaign.id).in('id', ids);
  revalidatePath('/dm/zones');
  revalidatePath('/dm');
  go('/dm/zones', 'ok', `${ids.length} zone${ids.length === 1 ? '' : 's'} deleted.`);
}

export async function importZones(formData: FormData) {
  const campaign = await requireDm();
  const back = '/dm/zones';
  const parsed = parseZonesImport(await readJsonUpload(formData, back));
  if (!parsed.ok) go(back, 'error', importErrors(parsed.errors));

  const { data: items } = await db().from('item').select('id,item_no,is_wondrous').eq('campaign_id', campaign.id);
  const itemRows = (items ?? []) as { id: string; item_no: number; is_wondrous: boolean }[];
  const itemIdByNo = new Map(itemRows.map((i) => [i.item_no, i.id]));
  const wondrousByNo = new Map(itemRows.map((i) => [i.item_no, i.is_wondrous]));

  // Cek semua referensi item dulu, sebelum ada yang ditulis.
  const missing = missingItemRefs(parsed.rows, new Set(itemIdByNo.keys()));
  if (missing.length > 0) go(back, 'error', `${importErrors(missing)}. Import the items first.`);

  // Junk pool: tanpa Wondrous. Rare pool: hanya Wondrous.
  const wrongPool: string[] = [];
  parsed.rows.forEach((r, idx) => {
    const badJunk = r.junk.filter((e) => wondrousByNo.get(e.itemNo)).map((e) => formatItemId(e.itemNo));
    const badRare = r.rare.filter((e) => !wondrousByNo.get(e.itemNo)).map((e) => formatItemId(e.itemNo));
    if (badJunk.length) wrongPool.push(`Zone #${idx + 1} (${r.name}): Wondrous item ${badJunk.join(', ')} cannot be in junk`);
    if (badRare.length) wrongPool.push(`Zone #${idx + 1} (${r.name}): Junk item ${badRare.join(', ')} cannot be in rare`);
  });
  if (wrongPool.length > 0) go(back, 'error', importErrors(wrongPool));

  const { data: existing } = await db().from('zone').select('zone_no').eq('campaign_id', campaign.id);
  const existingNos = new Set((existing ?? []).map((r) => (r as { zone_no: number }).zone_no));
  let next = Math.max(0, ...existingNos, ...parsed.rows.map((r) => r.no ?? 0));

  const zoneRows = parsed.rows.map((r) => ({
    campaign_id: campaign.id,
    zone_no: r.no ?? ++next,
    name: r.name,
    dc: r.dc,
  }));
  const { data: saved, error } = await db()
    .from('zone')
    .upsert(zoneRows, { onConflict: 'campaign_id,zone_no' })
    .select('id,zone_no');
  if (error || !saved) go(back, 'error', 'Import failed. No zones were changed.');

  const idByNo = new Map(saved.map((z) => [(z as { zone_no: number }).zone_no, (z as { id: string }).id]));
  const toEntries = (list: { itemNo: number; weight: number }[]) =>
    list.map((e) => ({ item_id: itemIdByNo.get(e.itemNo)!, weight: e.weight }));

  let failed = 0;
  for (let i = 0; i < parsed.rows.length; i++) {
    const zoneId = idByNo.get(zoneRows[i].zone_no);
    const ok = zoneId && (await syncZoneItems(zoneId, toEntries(parsed.rows[i].junk), toEntries(parsed.rows[i].rare)));
    if (!ok) failed++;
  }

  const created = zoneRows.filter((r) => !existingNos.has(r.zone_no)).length;
  revalidatePath(back);
  revalidatePath('/dm');
  if (failed > 0) go(back, 'error', `Import done, but ${failed} zone(s) could not fill their items. Import again.`);
  go(back, 'ok', `Import done: ${created} new, ${zoneRows.length - created} updated.`);
}

// ======================= Zona aktif =======================

export async function setActiveZone(formData: FormData) {
  const campaign = await requireDm();
  const zoneId = String(formData.get('zone_id') ?? '');

  if (zoneId) {
    if (!uuid.safeParse(zoneId).success) go('/dm/zones/active', 'error', 'Zone not found.');
    const { data } = await db().from('zone').select('id').eq('id', zoneId).eq('campaign_id', campaign.id).maybeSingle();
    if (!data) go('/dm/zones/active', 'error', 'Zone not found.');
  }
  await db()
    .from('campaign')
    .update({ active_zone_id: zoneId || null })
    .eq('id', campaign.id);
  revalidatePath('/dm');
  go('/dm', 'ok', zoneId ? 'Active zone changed.' : 'Active zone cleared.');
}

/** Disable/Enable: mematikan scavenge untuk semua pemain tanpa mengganti zona aktif. */
export async function setZoneEnabled(formData: FormData) {
  const campaign = await requireDm();
  const enabled = formData.get('enabled') === '1';
  await db().from('campaign').update({ zone_enabled: enabled }).eq('id', campaign.id);
  revalidatePath('/dm');
  go('/dm', 'ok', enabled ? 'Zone enabled. Players can scavenge.' : 'Zone disabled. Scavenging is off.');
}

// ======================= Karakter =======================

// DM hanya mengurus nama dan kode akses karakter. Class, level, dan stat diisi pemain sendiri
// (lihat saveCharacter di lib/actions/player.ts).
const characterNameSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(40),
});

// Nilai awal sebelum pemain mengisi karakternya (sama dengan default di schema.sql).
const CHARACTER_DEFAULTS = {
  class: '',
  level: 1,
  str: 10,
  dex: 10,
  con: 10,
  int_score: 10,
  wis: 10,
  cha: 10,
  invest_proficient: false,
  invest_expertise: false,
  invest_bonus: 0,
  slot_bonus: 0,
};

export async function saveCharacterDm(formData: FormData) {
  const campaign = await requireDm();
  const id = String(formData.get('id') ?? '');
  const back = id ? `/dm/characters/${id}/edit` : '/dm/characters/new';

  const parsed = characterNameSchema.safeParse(raw(formData));
  if (!parsed.success) go(back, 'error', firstIssue(parsed.error));
  const { name } = parsed.data;
  const duplicate = 'That character name is already taken.';

  if (id) {
    // Mengedit hanya mengubah nama: stat dan status setup milik pemain tidak disentuh.
    const { error } = await db().from('character').update({ name }).eq('id', id).eq('campaign_id', campaign.id);
    if (error) go(back, 'error', error.code === '23505' ? duplicate : 'Could not save the character.');
    revalidatePath('/dm/characters');
    go('/dm/characters', 'ok', `Character "${name}" saved.`);
  }

  // Kode yang tampil di form (kanan atas) dipakai apa adanya; kalau tidak valid, buat baru.
  const posted = String(formData.get('access_code') ?? '');
  const code = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(posted) ? posted : generateAccessCode();
  const charNo = (await maxNo('character', 'char_no', campaign.id)) + 1;
  const { error } = await db()
    .from('character')
    .insert({ ...CHARACTER_DEFAULTS, name, setup_done: false, campaign_id: campaign.id, char_no: charNo, access_code: code });
  if (error) go(back, 'error', error.code === '23505' ? duplicate : 'Could not create the character.');

  revalidatePath('/dm/characters');
  go('/dm/characters', 'ok', `Character "${name}" (${formatCharId(charNo)}) created. Code: ${code}`);
}

export async function resetCharacterCode(formData: FormData) {
  const campaign = await requireDm();
  const id = String(formData.get('id') ?? '');
  if (!uuid.safeParse(id).success) go('/dm/characters', 'error', 'Character not found.');
  const code = generateAccessCode();
  // Kode baru membuat sesi lama pemain tidak berlaku lagi (lihat fingerprint di session.ts).
  await db().from('character').update({ access_code: code }).eq('id', id).eq('campaign_id', campaign.id);
  revalidatePath('/dm/characters');
  go(`/dm/characters/${id}`, 'ok', `New code: ${code}`);
}

export async function deleteCharacters(formData: FormData) {
  const campaign = await requireDm();
  const ids = idsOf(formData);
  if (ids.length === 0) go('/dm/characters', 'error', 'No characters selected.');
  await db().from('character').delete().eq('campaign_id', campaign.id).in('id', ids);
  revalidatePath('/dm/characters');
  revalidatePath('/dm');
  go('/dm/characters', 'ok', `${ids.length} character${ids.length === 1 ? '' : 's'} deleted.`);
}