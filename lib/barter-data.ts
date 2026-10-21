import 'server-only';
import { db } from './db';
import {
  checkTrade,
  describeBundle,
  emptyBundle,
  parseBundle,
  serializeBundle,
  type Bundle,
  type Party,
  type TradeCheck,
} from './barter';
import type { ItemDef } from './core';
import { loadInventory, toItemDef, writeLog, type Inventory } from './inventory';
import type { Character, Item, Trade } from './types';

/** Isi Inventory (bukan Storage) sebagai pihak dalam barter. */
export const partyFrom = (inv: Inventory): Party => ({
  items: new Map(inv.inventory.items.map((h) => [h.item.id, h.quantity])),
  scrap: inv.inventory.scrap,
  usedQ: inv.usedQ,
  capacityQ: inv.capacity * 4,
});

export async function loadItemsById(ids: string[]): Promise<Map<string, Item>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await db().from('item').select('*').in('id', unique);
  return new Map(((data ?? []) as Item[]).map((i) => [i.id, i]));
}

export const tradeItemIds = (t: Trade): string[] => [
  ...parseBundle(t.offer).items.map((l) => l.itemId),
  ...parseBundle(t.request).items.map((l) => l.itemId),
];

export interface TradeView {
  trade: Trade;
  sender: Character;
  receiver: Character;
  offer: Bundle;
  request: Bundle; // kosong pada mode give
  names: Map<string, string>;
  check: TradeCheck;
}

export type TradeBase = Pick<TradeView, 'trade' | 'sender' | 'receiver' | 'offer' | 'request' | 'names'>;

/** Muat kedua karakter, isi tawaran, dan nama item (tanpa cek inventori). Null bila salah satu karakter sudah tidak ada. */
export async function loadTradeBase(trade: Trade): Promise<TradeBase | null> {
  const { data } = await db().from('character').select('*').in('id', [trade.from_character, trade.to_character]);
  const chars = (data ?? []) as Character[];
  const sender = chars.find((c) => c.id === trade.from_character);
  const receiver = chars.find((c) => c.id === trade.to_character);
  if (!sender || !receiver) return null;

  const offer = parseBundle(trade.offer);
  const request = trade.mode === 'swap' ? parseBundle(trade.request) : emptyBundle();
  const items = await loadItemsById(tradeItemIds(trade));
  const names = new Map([...items].map(([id, item]) => [id, item.name]));
  return { trade, sender, receiver, offer, request, names };
}

/** Muat kedua pihak dan cek apakah tawaran masih bisa dijalankan sekarang. Null bila salah satu karakter sudah tidak ada. */
export async function evaluateTrade(trade: Trade): Promise<TradeView | null> {
  const base = await loadTradeBase(trade);
  if (!base) return null;
  const [items, senderInv, receiverInv] = await Promise.all([
    loadItemsById(tradeItemIds(trade)),
    loadInventory(base.sender),
    loadInventory(base.receiver),
  ]);
  const defs = new Map<string, ItemDef>([...items].map(([id, item]) => [id, toItemDef(item)]));

  const check = checkTrade({
    mode: trade.mode,
    offer: base.offer,
    request: base.request,
    sender: partyFrom(senderInv),
    receiver: partyFrom(receiverInv),
    defs,
  });
  return { ...base, check };
}

export type TradeLogAction = 'offered' | 'accepted' | 'declined' | 'cancelled' | 'auto_cancelled';

/** Catat peristiwa barter. `actor` adalah karakter yang melakukannya (pada pembatalan otomatis: pengirim). */
export function logTrade(
  actor: Character,
  action: TradeLogAction,
  v: TradeBase,
  note?: string,
) {
  return writeLog(actor, 'trade', {
    action,
    trade_id: v.trade.id,
    mode: v.trade.mode,
    from: { id: v.sender.id, name: v.sender.name },
    to: { id: v.receiver.id, name: v.receiver.name },
    offer: serializeBundle(v.offer),
    request: v.trade.mode === 'swap' ? serializeBundle(v.request) : null,
    offer_text: describeBundle(v.offer, v.names),
    request_text: v.trade.mode === 'swap' ? describeBundle(v.request, v.names) : null,
    note: note ?? null,
  });
}

/** Ubah status hanya bila masih berstatus `from`. True bila tepat satu baris berubah (klaim berhasil). */
export async function transitionTrade(id: string, from: Trade['status'], to: Trade['status']): Promise<boolean> {
  const { data, error } = await db().from('trade').update({ status: to }).eq('id', id).eq('status', from).select('id');
  return !error && (data ?? []).length === 1;
}

/**
 * Batalkan otomatis tawaran pending milik `charId` yang barangnya sudah berubah/hilang.
 * Dipanggil saat halaman barter dibuka, supaya tawaran basi tidak menumpuk.
 */
export async function sweepStaleTrades(charId: string, campaignId: string): Promise<void> {
  const { data } = await db()
    .from('trade')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .or(`from_character.eq.${charId},to_character.eq.${charId}`);
  for (const trade of (data ?? []) as Trade[]) {
    const v = await evaluateTrade(trade);
    if (!v) {
      await transitionTrade(trade.id, 'pending', 'cancelled');
      continue;
    }
    if (!v.check.ok && v.check.reason === 'changed' && (await transitionTrade(trade.id, 'pending', 'cancelled'))) {
      await logTrade(v.sender, 'auto_cancelled', v, 'Items changed before the offer was accepted.');
    }
  }
}
