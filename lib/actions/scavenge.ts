'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import {
  MAX_SCAVENGES_PER_DAY,
  abilityMod,
  canBreakdown,
  checkFit,
  clampKeepScrap,
  cryptoRng,
  investigationModifier,
  itemQuarters,
  remainderScrap,
  resolveScavenge,
  scrapQuarters,
  scrapTotal,
  wibDay,
  type Scrap,
} from '@/lib/core';
import { changeHolding, changeScrap, isLocation, loadInventory, toItemDef, writeLog } from '@/lib/inventory';
import type { Campaign, Item, Zone, ZoneItem } from '@/lib/types';

const HOME = '/play';
const uuid = z.string().uuid();
const checked = (fd: FormData, k: string) => fd.get(k) === 'on';

interface PendingRow {
  id: string;
  character_id: string;
  item_id: string | null;
  scrap: Scrap | null;
}

// ======================= Scavenge =======================

export async function scavenge(formData: FormData) {
  const me = await requirePlayer();
  if (!me.setup_done) go('/play/setup', 'error', 'Fill in your character first.');

  const { data: camp } = await db().from('campaign').select('*').eq('id', me.campaign_id).maybeSingle();
  const campaign = camp as Campaign | null;
  if (!campaign?.active_zone_id) go(HOME, 'error', 'The DM has not set a zone yet.');
  if (!campaign.zone_enabled) go(HOME, 'error', 'Scavenging is disabled right now.');

  // Selesaikan temuan sebelumnya dulu supaya tidak menumpuk.
  const { count } = await db().from('pending_find').select('id', { count: 'exact', head: true }).eq('character_id', me.id);
  if ((count ?? 0) > 0) go(HOME, 'error', 'Decide on your current finds before scavenging again.');

  const { data: z } = await db().from('zone').select('*').eq('id', campaign.active_zone_id).maybeSingle();
  const zone = z as Zone | null;
  if (!zone) go(HOME, 'error', 'Zone not found.');

  // ---- Ambil jatah harian (reset 00.00 WIB) ----
  const day = wibDay(new Date());
  await db().from('scavenge_day').upsert({ character_id: me.id, day, used: 0 }, { onConflict: 'character_id,day', ignoreDuplicates: true });
  const { data: dayRow } = await db().from('scavenge_day').select('used').eq('character_id', me.id).eq('day', day).maybeSingle();
  const used = (dayRow as { used: number } | null)?.used ?? 0;
  if (used >= MAX_SCAVENGES_PER_DAY) go(HOME, 'error', `You have used all ${MAX_SCAVENGES_PER_DAY} scavenges today. Resets at 00:00 WIB.`);
  const { data: claimed } = await db()
    .from('scavenge_day')
    .update({ used: used + 1 })
    .eq('character_id', me.id)
    .eq('day', day)
    .eq('used', used)
    .select('used');
  if ((claimed ?? []).length !== 1) go(HOME, 'error', 'Please try again.');

  // ---- Pool zona ----
  const { data: zi } = await db().from('zone_item').select('*').eq('zone_id', zone.id);
  const entries = (zi ?? []) as ZoneItem[];
  const itemIds = [...new Set(entries.map((e) => e.item_id))];
  const { data: itemRows } = itemIds.length
    ? await db().from('item').select('*').in('id', itemIds)
    : { data: [] };
  const items = new Map(((itemRows ?? []) as Item[]).map((i) => [i.id, i]));

  const toPool = (rare: boolean) =>
    entries.filter((e) => e.is_rare === rare && items.has(e.item_id)).map((e) => ({ itemId: e.item_id, weight: e.weight }));

  const modifier = investigationModifier({
    level: me.level,
    intScore: me.int_score,
    proficient: me.invest_proficient,
    expertise: me.invest_expertise,
    bonus: me.invest_bonus,
  });
  const outcome = resolveScavenge(
    cryptoRng,
    {
      modifier,
      intModifier: abilityMod(me.int_score),
      advantage: checked(formData, 'advantage'),
      disadvantage: checked(formData, 'disadvantage'),
      guidance: checked(formData, 'guidance'),
    },
    { dc: zone.dc, items: toPool(false), rareItems: toPool(true) },
  );

  const loose = outcome.looseScrap && scrapTotal(outcome.looseScrap) > 0 ? outcome.looseScrap : null;

  await writeLog(me, 'scavenge', {
    zone: { id: zone.id, no: zone.zone_no, name: zone.name, dc: zone.dc },
    roll: outcome.roll,
    kind: outcome.kind,
    int_modifier: abilityMod(me.int_score),
    jackpot_die: outcome.jackpotDie ?? null,
    items: outcome.itemIds.map((id) => ({ id, name: items.get(id)?.name ?? '?' })),
    loose_scrap: loose,
    exhaustion: outcome.exhaustion,
    day,
    used_after: used + 1,
  });

  const pending = [
    ...outcome.itemIds.map((item_id) => ({ character_id: me.id, item_id })),
    ...(loose ? [{ character_id: me.id, scrap: loose }] : []),
  ];
  if (pending.length > 0) await db().from('pending_find').insert(pending);

  if (outcome.exhaustion) {
    await db().from('character').update({ pending_exhaustion: me.pending_exhaustion + 1 }).eq('id', me.id);
  }

  revalidatePath(HOME);
  go(HOME, 'ok', 'Roll complete.');
}

// ======================= Keputusan atas temuan =======================

const decisionSchema = z.object({
  find_id: uuid,
  // "keep:inventory", "keep:storage", "breakdown:inventory", "breakdown:storage", "discard",
  // serta "keep-partial:inventory" / "breakdown-partial:inventory" (simpan sebagian scrap, sisanya dibuang)
  choice: z.string().regex(/^(keep|breakdown):(inventory|storage)$|^(keep|breakdown)-partial:inventory$|^discard$/),
});

const scrapLabel = (s: Scrap): string =>
  (['bio', 'arcane', 'mech', 'ferrous'] as const)
    .filter((k) => s[k] > 0)
    .map((k) => `${s[k]} ${k[0].toUpperCase()}${k.slice(1)}`)
    .join(', ');

export async function decideFind(findId: string, choice: string, formData?: FormData) {
  const me = await requirePlayer();
  const parsed = decisionSchema.safeParse({ find_id: findId, choice });
  if (!parsed.success) go(HOME, 'error', 'Invalid choice.');
  const { find_id } = parsed.data;
  const [rawAction, destRaw] = parsed.data.choice.split(':') as [string, string | undefined];
  const partial = rawAction.endsWith('-partial');
  const action = rawAction.replace('-partial', '') as 'keep' | 'breakdown' | 'discard';
  const dest = isLocation(destRaw) ? destRaw : 'inventory';

  const { data } = await db().from('pending_find').select('*').eq('id', find_id).eq('character_id', me.id).maybeSingle();
  const find = data as PendingRow | null;
  if (!find) go(HOME, 'error', 'This find was already handled.');

  let item: Item | null = null;
  if (find.item_id) {
    const { data: it } = await db().from('item').select('*').eq('id', find.item_id).maybeSingle();
    item = it as Item | null;
    if (!item) {
      await db().from('pending_find').delete().eq('id', find.id);
      go(HOME, 'error', 'That item no longer exists.');
    }
  }
  const name = item?.name ?? 'Loose Scrap';

  // Apa yang akan ditambahkan, dan berapa kuartal?
  let addItem = false;
  let addScrap: Scrap | null = null;
  let droppedScrap: Scrap | null = null; // hanya terisi pada "simpan sebagian": scrap yang dibuang agar muat
  if (action === 'keep') {
    if (item) addItem = true;
    else addScrap = find.scrap;
  } else if (action === 'breakdown') {
    if (!item || !canBreakdown(toItemDef(item))) go(HOME, 'error', 'This cannot be broken down.');
    addScrap = toItemDef(item).yield;
  }

  if (partial) {
    // Hanya untuk scrap (loose scrap atau hasil breakdown). Jumlah yang disimpan diambil dari form modal.
    if (!addScrap || addItem) go(HOME, 'error', 'Invalid choice.');
    const num = (k: string) => Number(formData?.get(`keep_${k}`) ?? 0);
    const keep = clampKeepScrap(addScrap, { bio: num('bio'), arcane: num('arcane'), mech: num('mech'), ferrous: num('ferrous') });
    droppedScrap = remainderScrap(addScrap, keep);
    addScrap = keep;
  }

  const addQ = (addItem && item ? itemQuarters(toItemDef(item)) : 0) + (addScrap ? scrapQuarters(addScrap) : 0);
  if (dest === 'inventory' && addQ > 0) {
    const inv = await loadInventory(me);
    if (!checkFit(inv.capacity, inv.usedQ, addQ).fits) {
      go(HOME, 'error', 'Not enough inventory space. Send it to Storage or discard it.');
    }
  }

  // Klaim temuan (hapus dulu). Bila sudah diklaim permintaan lain, berhenti.
  const { data: claimed } = await db().from('pending_find').delete().eq('id', find.id).select('id');
  if ((claimed ?? []).length !== 1) go(HOME, 'error', 'This find was already handled.');

  let ok = true;
  if (addItem && item) ok = await changeHolding(me.id, item.id, dest, 1);
  if (ok && addScrap && scrapTotal(addScrap) > 0) ok = await changeScrap(me.id, dest, addScrap);
  if (!ok) {
    await db().from('pending_find').insert({ id: find.id, character_id: me.id, item_id: find.item_id, scrap: find.scrap });
    go(HOME, 'error', 'Could not save. Try again.');
  }

  await writeLog(me, 'decision', {
    action,
    dest: action === 'discard' ? null : dest,
    name,
    scrap: addScrap,
    dropped_scrap: droppedScrap && scrapTotal(droppedScrap) > 0 ? droppedScrap : null,
    item_id: item?.id ?? null,
  });
  revalidatePath(HOME);
  revalidatePath('/play/inventory');
  revalidatePath('/play/storage');

  const where = dest === 'storage' ? 'Storage' : 'Inventory';
  const dropNote = droppedScrap && scrapTotal(droppedScrap) > 0 ? `, discarded ${scrapLabel(droppedScrap)}` : '';
  const msg = partial
    ? `${name}: kept ${addScrap && scrapTotal(addScrap) > 0 ? scrapLabel(addScrap) : 'nothing'} in ${where}${dropNote}.`
    : action === 'discard' ? `${name} discarded.` : action === 'breakdown' ? `${name} broken down into scrap (${where}).` : `${name} kept in ${where}.`;
  go(HOME, 'ok', msg);
}