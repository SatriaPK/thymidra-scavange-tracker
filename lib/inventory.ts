import 'server-only';
import { db } from './db';
import {
  emptyScrap,
  scrapQuarters,
  slotCapacity,
  usedQuarters,
  type ItemDef,
  type Scrap,
} from './core';
import type { Character, Item } from './types';

export type Location = 'inventory' | 'storage';
export const isLocation = (v: unknown): v is Location => v === 'inventory' || v === 'storage';
export const otherLocation = (l: Location): Location => (l === 'inventory' ? 'storage' : 'inventory');

export const toItemDef = (i: Item): ItemDef => ({
  id: i.id,
  name: i.name,
  slotWeight: i.slot_weight,
  yield: { bio: i.yield_bio, arcane: i.yield_arcane, mech: i.yield_mech, ferrous: i.yield_ferrous },
});

export interface HeldItem {
  holdingId: string;
  item: Item;
  def: ItemDef;
  quantity: number;
}

export interface Bag {
  items: HeldItem[];
  scrap: Scrap;
}

export interface Inventory {
  inventory: Bag;
  storage: Bag;
  capacity: number; // slot penuh
  usedQ: number; // kuartal terpakai di inventori
}

const scrapFrom = (row: Partial<Scrap> | null | undefined): Scrap => ({
  bio: row?.bio ?? 0,
  arcane: row?.arcane ?? 0,
  mech: row?.mech ?? 0,
  ferrous: row?.ferrous ?? 0,
});

export async function loadInventory(me: Character): Promise<Inventory> {
  const [hRes, sRes] = await Promise.all([
    db().from('holding').select('id,item_id,location,quantity, item(*)').eq('character_id', me.id),
    db().from('scrap').select('*').eq('character_id', me.id),
  ]);

  const bags: Record<Location, Bag> = {
    inventory: { items: [], scrap: emptyScrap() },
    storage: { items: [], scrap: emptyScrap() },
  };

  type Row = { id: string; location: Location; quantity: number; item: Item | Item[] | null };
  for (const r of (hRes.data ?? []) as unknown as Row[]) {
    const item = Array.isArray(r.item) ? r.item[0] : r.item;
    if (!item || !isLocation(r.location)) continue;
    bags[r.location].items.push({ holdingId: r.id, item, def: toItemDef(item), quantity: r.quantity });
  }
  for (const row of (sRes.data ?? []) as (Partial<Scrap> & { location: Location })[]) {
    if (isLocation(row.location)) bags[row.location].scrap = scrapFrom(row);
  }
  for (const loc of ['inventory', 'storage'] as const) {
    bags[loc].items.sort((a, b) => a.item.item_no - b.item.item_no);
  }

  const capacity = slotCapacity({ strScore: me.str, slotBonus: me.slot_bonus });
  const usedQ = usedQuarters(
    bags.inventory.items.map((h) => ({ item: h.def, quantity: h.quantity })),
    bags.inventory.scrap,
  );
  return { ...bags, capacity, usedQ };
}

/** Tambah (qty > 0) atau kurangi (qty < 0) jumlah item. Mengembalikan false bila stok tidak cukup. */
export async function changeHolding(charId: string, itemId: string, loc: Location, delta: number): Promise<boolean> {
  const { data } = await db()
    .from('holding')
    .select('id,quantity')
    .eq('character_id', charId)
    .eq('item_id', itemId)
    .eq('location', loc)
    .maybeSingle();
  const current = (data as { id: string; quantity: number } | null)?.quantity ?? 0;
  const next = current + delta;
  if (next < 0) return false;

  if (!data) {
    if (next === 0) return true;
    const { error } = await db().from('holding').insert({ character_id: charId, item_id: itemId, location: loc, quantity: next });
    return !error;
  }
  if (next === 0) {
    const { error } = await db().from('holding').delete().eq('id', (data as { id: string }).id);
    return !error;
  }
  // Update bersyarat pada nilai lama: bila berubah di tengah jalan (klik ganda), gagal dan tidak menimpa.
  const { data: updated, error } = await db()
    .from('holding')
    .update({ quantity: next })
    .eq('id', (data as { id: string }).id)
    .eq('quantity', current)
    .select('id');
  return !error && (updated ?? []).length === 1;
}

/** Tambah/kurangi scrap per tipe. Mengembalikan false bila ada tipe yang tidak cukup. */
export async function changeScrap(charId: string, loc: Location, delta: Partial<Scrap>): Promise<boolean> {
  const { data } = await db().from('scrap').select('*').eq('character_id', charId).eq('location', loc).maybeSingle();
  const cur = scrapFrom(data as Partial<Scrap> | null);
  const next: Scrap = {
    bio: cur.bio + (delta.bio ?? 0),
    arcane: cur.arcane + (delta.arcane ?? 0),
    mech: cur.mech + (delta.mech ?? 0),
    ferrous: cur.ferrous + (delta.ferrous ?? 0),
  };
  if (Object.values(next).some((v) => v < 0)) return false;

  if (!data) {
    const { error } = await db().from('scrap').insert({ character_id: charId, location: loc, ...next });
    return !error;
  }
  const { data: updated, error } = await db()
    .from('scrap')
    .update(next)
    .eq('character_id', charId)
    .eq('location', loc)
    .eq('bio', cur.bio)
    .eq('arcane', cur.arcane)
    .eq('mech', cur.mech)
    .eq('ferrous', cur.ferrous)
    .select('character_id');
  return !error && (updated ?? []).length === 1;
}

export const scrapAmountQuarters = scrapQuarters;

export function writeLog(me: Character, kind: string, payload: Record<string, unknown>) {
  return db()
    .from('log')
    .insert({ campaign_id: me.campaign_id, character_id: me.id, kind, payload })
    .select('id')
    .single();
}