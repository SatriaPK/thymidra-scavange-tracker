// Logika murni barter (tanpa I/O) supaya mudah diuji.
//
// Aturan:
// - Barang yang dibarter diambil dari Inventory pengirim dan masuk ke Inventory penerima.
// - Mode "give": sepihak. Mode "swap": pengirim menawarkan `offer` dan meminta `request` dari penerima.
// - Barang tidak dikunci saat tawaran dibuat. Saat diterima, semuanya dicek ulang:
//   bila barang sudah berubah/hilang, tawaran batal; bila penerima (atau pengirim, pada swap) tidak punya ruang, belum bisa diterima.
import { emptyScrap, itemQuarters, scrapQuarters, scrapTotal, SCRAP_TYPES, type ItemDef, type Scrap } from './core';

export type TradeMode = 'give' | 'swap';
export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export const MAX_PENDING_OUTGOING = 5;
export const MAX_QTY = 9999;

export interface TradeLine {
  itemId: string;
  qty: number;
}

export interface Bundle {
  items: TradeLine[];
  scrap: Scrap;
}

export const emptyBundle = (): Bundle => ({ items: [], scrap: emptyScrap() });
export const bundleIsEmpty = (b: Bundle): boolean => b.items.length === 0 && scrapTotal(b.scrap) === 0;

const posInt = (v: unknown, max = MAX_QTY): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
};

/** Baca bundle dari JSON (kolom jsonb). Entri tidak valid dibuang, item kembar digabung. */
export function parseBundle(raw: unknown): Bundle {
  const out = emptyBundle();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { items?: unknown; scrap?: unknown };

  const merged = new Map<string, number>();
  if (Array.isArray(r.items)) {
    for (const e of r.items) {
      const id = (e as { item_id?: unknown })?.item_id;
      const qty = posInt((e as { qty?: unknown })?.qty);
      if (typeof id === 'string' && id && qty > 0) merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + qty));
    }
  }
  out.items = [...merged].map(([itemId, qty]) => ({ itemId, qty }));

  const s = (r.scrap ?? {}) as Partial<Record<string, unknown>>;
  for (const t of SCRAP_TYPES) out.scrap[t] = posInt(s[t]);
  return out;
}

/** Bentuk JSON untuk disimpan di kolom offer/request. */
export const serializeBundle = (b: Bundle) => ({
  items: b.items.map((l) => ({ item_id: l.itemId, qty: l.qty })),
  scrap: { ...b.scrap },
});

/** Satu pihak: isi Inventory, dan kapasitas/pemakaian dalam kuartal. */
export interface Party {
  items: Map<string, number>; // item id -> jumlah di Inventory
  scrap: Scrap; // scrap di Inventory
  usedQ: number;
  capacityQ: number;
}

/** Apakah `party` masih punya semua barang di `bundle`? */
export function covers(party: Party, bundle: Bundle): boolean {
  if (bundle.items.some((l) => (party.items.get(l.itemId) ?? 0) < l.qty)) return false;
  return SCRAP_TYPES.every((t) => party.scrap[t] >= bundle.scrap[t]);
}

/** Ruang yang dipakai bundle di Inventory (kuartal), atau null bila ada item yang tidak dikenal. */
export function bundleQuarters(b: Bundle, defs: Map<string, ItemDef>): number | null {
  let q = scrapQuarters(b.scrap);
  for (const l of b.items) {
    const def = defs.get(l.itemId);
    if (!def) return null;
    q += itemQuarters(def) * l.qty;
  }
  return q;
}

export type TradeCheck =
  | { ok: true }
  | { ok: false; reason: 'changed' }
  | { ok: false; reason: 'no_room_receiver' | 'no_room_sender'; overQ: number };

export interface TradeInput {
  mode: TradeMode;
  offer: Bundle;
  request: Bundle;
  sender: Party;
  receiver: Party;
  defs: Map<string, ItemDef>;
}

/** Selisih ruang (kuartal) di atas kapasitas bila pihak ini mendapat `netQ` tambahan; 0 bila muat atau tidak bertambah. */
const overflow = (p: Party, netQ: number): number => (netQ > 0 ? Math.max(0, p.usedQ + netQ - p.capacityQ) : 0);

export function checkTrade({ mode, offer, request, sender, receiver, defs }: TradeInput): TradeCheck {
  const asked = mode === 'swap' ? request : emptyBundle();
  if (!covers(sender, offer) || !covers(receiver, asked)) return { ok: false, reason: 'changed' };

  const offerQ = bundleQuarters(offer, defs);
  const askedQ = bundleQuarters(asked, defs);
  if (offerQ === null || askedQ === null) return { ok: false, reason: 'changed' };

  const receiverOver = overflow(receiver, offerQ - askedQ);
  if (receiverOver > 0) return { ok: false, reason: 'no_room_receiver', overQ: receiverOver };
  const senderOver = overflow(sender, askedQ - offerQ);
  if (senderOver > 0) return { ok: false, reason: 'no_room_sender', overQ: senderOver };
  return { ok: true };
}

/** Teks ringkas untuk pesan dan log, mis. "2x Rusty Gear, 3 Bio, 1 Mech". */
export function describeBundle(b: Bundle, names: Map<string, string>): string {
  const parts: string[] = [];
  for (const l of b.items) parts.push(`${l.qty}x ${names.get(l.itemId) ?? 'Unknown item'}`);
  for (const t of SCRAP_TYPES) if (b.scrap[t] > 0) parts.push(`${b.scrap[t]} ${t[0].toUpperCase()}${t.slice(1)}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

/** Pesan untuk pemain saat belum ada ruang. */
export function roomShortfallText(overQ: number): string {
  const slots = overQ / 4;
  return `${slots} more slot${slots === 1 ? '' : 's'} needed`;
}
