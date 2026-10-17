'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import { canBreakdown, checkFit, itemQuarters, scrapQuarters, type Scrap } from '@/lib/core';
import { changeHolding, changeScrap, isLocation, loadInventory, otherLocation, toItemDef, writeLog, type Location } from '@/lib/inventory';
import type { Item } from '@/lib/types';

const uuid = z.string().uuid();
const qtySchema = z.coerce.number().int().min(1).max(9999);
const pathOf = (loc: Location) => (loc === 'storage' ? '/play/storage' : '/play/inventory');

function refresh() {
  revalidatePath('/play');
  revalidatePath('/play/inventory');
  revalidatePath('/play/storage');
}

function readLoc(fd: FormData): Location {
  const loc = String(fd.get('from') ?? '');
  return isLocation(loc) ? loc : 'inventory';
}

async function loadItem(id: string): Promise<Item | null> {
  const { data } = await db().from('item').select('*').eq('id', id).maybeSingle();
  return data as Item | null;
}

const SCRAP_TYPES = ['bio', 'arcane', 'mech', 'ferrous'] as const;
const scrapLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- Item ----------

/** Satu aksi item: pindah ke tempat lain, breakdown, atau buang. */
export async function itemAction(action: string, formData: FormData) {
  const me = await requirePlayer();
  const from = readLoc(formData);
  const back = pathOf(from);

  const itemId = uuid.safeParse(formData.get('item_id'));
  const qty = qtySchema.safeParse(formData.get('qty') || 1);
  if (!itemId.success || !qty.success || !['move', 'breakdown', 'discard'].includes(action)) go(back, 'error', 'Invalid input.');

  const item = await loadItem(itemId.data);
  if (!item) go(back, 'error', 'Item not found.');
  const def = toItemDef(item);
  const n = qty.data;

  const inv = await loadInventory(me);
  const held = inv[from].items.find((h) => h.item.id === item.id)?.quantity ?? 0;
  if (held < n) go(back, 'error', `You only have ${held}.`);

  if (action === 'discard') {
    if (!(await changeHolding(me.id, item.id, from, -n))) go(back, 'error', 'Could not discard. Try again.');
    await writeLog(me, 'decision', { action: 'discard', from, name: item.name, qty: n, item_id: item.id });
    refresh();
    go(back, 'ok', `${n}x ${item.name} discarded.`);
  }

  if (action === 'move') {
    const to = otherLocation(from);
    if (to === 'inventory') {
      const fit = checkFit(inv.capacity, inv.usedQ, itemQuarters(def) * n);
      if (!fit.fits) go(back, 'error', 'Not enough inventory space.');
    }
    if (!(await changeHolding(me.id, item.id, from, -n))) go(back, 'error', 'Could not move. Try again.');
    if (!(await changeHolding(me.id, item.id, to, n))) {
      await changeHolding(me.id, item.id, from, n); // kembalikan
      go(back, 'error', 'Could not move. Try again.');
    }
    await writeLog(me, 'transfer', { from, to, name: item.name, qty: n, item_id: item.id });
    refresh();
    go(back, 'ok', `${n}x ${item.name} moved to ${to === 'storage' ? 'Storage' : 'Inventory'}.`);
  }

  // breakdown: scrap masuk ke tempat yang sama dengan item
  if (!canBreakdown(def)) go(back, 'error', 'This cannot be broken down.');
  const gained: Scrap = {
    bio: def.yield.bio * n,
    arcane: def.yield.arcane * n,
    mech: def.yield.mech * n,
    ferrous: def.yield.ferrous * n,
  };
  if (from === 'inventory') {
    // Item dilepas (-slot) lalu scrap masuk (+slot): hitung selisih bersihnya.
    const net = scrapQuarters(gained) - itemQuarters(def) * n;
    if (net > 0 && !checkFit(inv.capacity, inv.usedQ, net).fits) go(back, 'error', 'Not enough inventory space for the scrap.');
  }
  if (!(await changeHolding(me.id, item.id, from, -n))) go(back, 'error', 'Could not break down. Try again.');
  if (!(await changeScrap(me.id, from, gained))) {
    await changeHolding(me.id, item.id, from, n);
    go(back, 'error', 'Could not break down. Try again.');
  }
  await writeLog(me, 'decision', { action: 'breakdown', from, name: item.name, qty: n, scrap: gained, item_id: item.id });
  refresh();
  go(back, 'ok', `${n}x ${item.name} broken down into scrap.`);
}

// ---------- Scrap ----------

export async function scrapAction(action: string, formData: FormData) {
  const me = await requirePlayer();
  const from = readLoc(formData);
  const back = pathOf(from);

  const type = String(formData.get('type') ?? '');
  const qty = qtySchema.safeParse(formData.get('qty') || 1);
  if (!(SCRAP_TYPES as readonly string[]).includes(type) || !qty.success || !['move', 'discard'].includes(action)) {
    go(back, 'error', 'Invalid input.');
  }
  const t = type as (typeof SCRAP_TYPES)[number];
  const n = qty.data;

  const inv = await loadInventory(me);
  const have = inv[from].scrap[t];
  if (have < n) go(back, 'error', `You only have ${have} ${scrapLabel(t)}.`);
  const delta = { [t]: n } as Partial<Scrap>;
  const neg = { [t]: -n } as Partial<Scrap>;

  if (action === 'discard') {
    if (!(await changeScrap(me.id, from, neg))) go(back, 'error', 'Could not discard. Try again.');
    await writeLog(me, 'decision', { action: 'discard', from, name: `${scrapLabel(t)} scrap`, qty: n });
    refresh();
    go(back, 'ok', `${n} ${scrapLabel(t)} scrap discarded.`);
  }

  const to = otherLocation(from);
  if (to === 'inventory' && !checkFit(inv.capacity, inv.usedQ, n).fits) go(back, 'error', 'Not enough inventory space.');
  if (!(await changeScrap(me.id, from, neg))) go(back, 'error', 'Could not move. Try again.');
  if (!(await changeScrap(me.id, to, delta))) {
    await changeScrap(me.id, from, delta);
    go(back, 'error', 'Could not move. Try again.');
  }
  await writeLog(me, 'transfer', { from, to, name: `${scrapLabel(t)} scrap`, qty: n });
  refresh();
  go(back, 'ok', `${n} ${scrapLabel(t)} scrap moved to ${to === 'storage' ? 'Storage' : 'Inventory'}.`);
}