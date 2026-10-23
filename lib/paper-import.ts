import { SCRAP_TYPES, emptyScrap, type Scrap } from './core';

/** Batas per impor, supaya satu kiriman tidak bisa menyisipkan angka yang tidak masuk akal. */
export const MAX_IMPORT_LINES = 100;
export const MAX_IMPORT_QTY = 99;
export const MAX_IMPORT_SCRAP = 999;

export interface ImportLine {
  itemId: string;
  qty: number;
}
export interface ImportBag {
  items: ImportLine[];
  scrap: Scrap;
}
export interface PaperImport {
  inventory: ImportBag;
  storage: ImportBag;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseBag(raw: unknown, label: string): ImportBag | string {
  if (!isRecord(raw)) return `${label}: invalid data.`;

  const rawItems = raw.items ?? [];
  if (!Array.isArray(rawItems)) return `${label}: invalid item list.`;
  if (rawItems.length > MAX_IMPORT_LINES) return `${label}: at most ${MAX_IMPORT_LINES} different items.`;
  // Item yang sama di beberapa baris digabung.
  const merged = new Map<string, number>();
  for (const line of rawItems) {
    if (!isRecord(line) || typeof line.itemId !== 'string' || !UUID.test(line.itemId)) return `${label}: invalid item.`;
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_IMPORT_QTY) return `${label}: quantity must be 1 to ${MAX_IMPORT_QTY}.`;
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + qty);
  }
  for (const qty of merged.values()) if (qty > MAX_IMPORT_QTY) return `${label}: quantity must be 1 to ${MAX_IMPORT_QTY}.`;

  const rawScrap = raw.scrap ?? {};
  if (!isRecord(rawScrap)) return `${label}: invalid scrap.`;
  const scrap = emptyScrap();
  for (const t of SCRAP_TYPES) {
    const n = Number(rawScrap[t] ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > MAX_IMPORT_SCRAP) return `${label}: scrap must be 0 to ${MAX_IMPORT_SCRAP} per type.`;
    scrap[t] = n;
  }
  return { items: [...merged].map(([itemId, qty]) => ({ itemId, qty })), scrap };
}

/** Membaca dan memvalidasi kiriman form impor (JSON string). */
export function parsePaperImport(text: string): { ok: true; data: PaperImport } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid import data.' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'Invalid import data.' };
  const inventory = parseBag(raw.inventory, 'Inventory');
  if (typeof inventory === 'string') return { ok: false, error: inventory };
  const storage = parseBag(raw.storage, 'Storage');
  if (typeof storage === 'string') return { ok: false, error: storage };
  const empty = (b: ImportBag) => b.items.length === 0 && SCRAP_TYPES.every((t) => b.scrap[t] === 0);
  if (empty(inventory) && empty(storage)) return { ok: false, error: 'Nothing to import. Add at least one item or scrap.' };
  return { ok: true, data: { inventory, storage } };
}
