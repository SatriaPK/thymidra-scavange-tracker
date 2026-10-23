'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireDm, requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import { checkFit, itemQuarters, scrapQuarters, scrapTotal, quartersToSlots, type Scrap } from '@/lib/core';
import { changeHolding, changeScrap, loadInventory, toItemDef, writeLog, type Location } from '@/lib/inventory';
import { parsePaperImport, type ImportBag } from '@/lib/paper-import';
import type { Item } from '@/lib/types';

const BACK = '/play/import';
const uuid = z.string().uuid();

/** DM membuka atau menutup izin impor dari kertas untuk satu karakter. */
export async function setPaperImport(formData: FormData) {
  const campaign = await requireDm();
  const id = String(formData.get('id') ?? '');
  if (!uuid.safeParse(id).success) go('/dm/characters', 'error', 'Character not found.');
  const allow = formData.get('allow') === '1';
  const { data } = await db()
    .from('character')
    .update({ import_allowed: allow })
    .eq('id', id)
    .eq('campaign_id', campaign.id)
    .select('name');
  if ((data ?? []).length !== 1) go('/dm/characters', 'error', 'Character not found.');
  revalidatePath(`/dm/characters/${id}`);
  revalidatePath('/play');
  go(`/dm/characters/${id}`, 'ok', allow ? 'Paper import opened. The player can use it once.' : 'Paper import closed.');
}

/** Pemain memasukkan isi kertasnya. Hanya berjalan bila DM membuka izin, dan izin langsung menutup. */
export async function importFromPaper(formData: FormData) {
  const me = await requirePlayer();
  if (!me.setup_done) go('/play/setup', 'error', 'Fill in your character first.');
  if (!me.import_allowed) go('/play', 'error', 'Paper import is not open. Ask your DM.');

  const parsed = parsePaperImport(String(formData.get('payload') ?? ''));
  if (!parsed.ok) go(BACK, 'error', parsed.error);
  const data = parsed.data;

  // Semua item harus ada di campaign ini.
  const ids = [...new Set([...data.inventory.items, ...data.storage.items].map((l) => l.itemId))];
  const { data: rows } = ids.length
    ? await db().from('item').select('*').eq('campaign_id', me.campaign_id).in('id', ids)
    : { data: [] };
  const items = new Map(((rows ?? []) as Item[]).map((i) => [i.id, i]));
  if (items.size !== ids.length) go(BACK, 'error', 'Some items no longer exist. Reload the page.');

  const quarters = (bag: ImportBag) =>
    bag.items.reduce((sum, l) => sum + itemQuarters(toItemDef(items.get(l.itemId)!)) * l.qty, 0) + scrapQuarters(bag.scrap);

  // Bagian Inventory harus muat; Storage tidak dibatasi.
  const addQ = quarters(data.inventory);
  if (addQ > 0) {
    const inv = await loadInventory(me);
    if (!checkFit(inv.capacity, inv.usedQ, addQ).fits) {
      go(BACK, 'error', `The Inventory part needs ${quartersToSlots(addQ)} slots, but only ${quartersToSlots(Math.max(0, inv.capacity * 4 - inv.usedQ))} are free. Move some to Storage.`);
    }
  }

  // Tutup izin lebih dulu secara atomik: kiriman ganda atau izin yang ditutup DM di tengah jalan gagal di sini.
  const { data: claimed } = await db()
    .from('character')
    .update({ import_allowed: false })
    .eq('id', me.id)
    .eq('import_allowed', true)
    .select('id');
  if ((claimed ?? []).length !== 1) go('/play', 'error', 'Paper import is not open (or was already used).');

  // Terapkan satu per satu; bila ada yang gagal, batalkan yang sudah masuk dan buka kembali izinnya.
  const undo: (() => Promise<unknown>)[] = [];
  let ok = true;
  for (const loc of ['inventory', 'storage'] as Location[]) {
    const bag = data[loc];
    for (const line of bag.items) {
      if (!ok) break;
      ok = await changeHolding(me.id, line.itemId, loc, line.qty);
      if (ok) undo.push(() => changeHolding(me.id, line.itemId, loc, -line.qty));
    }
    if (ok && scrapTotal(bag.scrap) > 0) {
      ok = await changeScrap(me.id, loc, bag.scrap);
      if (ok) undo.push(() => changeScrap(me.id, loc, negate(bag.scrap)));
    }
  }
  if (!ok) {
    for (const fn of undo.reverse()) await fn();
    await db().from('character').update({ import_allowed: true }).eq('id', me.id);
    go(BACK, 'error', 'Could not save the import. Nothing was added. Try again.');
  }

  const summarize = (bag: ImportBag) => ({
    items: bag.items.map((l) => ({ id: l.itemId, name: items.get(l.itemId)?.name ?? '?', qty: l.qty })),
    scrap: scrapTotal(bag.scrap) > 0 ? bag.scrap : null,
  });
  await writeLog(me, 'paper_import', { inventory: summarize(data.inventory), storage: summarize(data.storage) });

  for (const p of ['/play', '/play/inventory', '/play/storage', '/play/import']) revalidatePath(p);
  go('/play/inventory', 'ok', 'Paper import done. It is now closed; ask your DM if something was missed.');
}

const negate = (s: Scrap): Scrap => ({ bio: -s.bio, arcane: -s.arcane, mech: -s.mech, ferrous: -s.ferrous });
