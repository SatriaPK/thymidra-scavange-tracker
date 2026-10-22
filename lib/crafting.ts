// Logika murni crafting (tanpa I/O) supaya mudah diuji.
//
// Aturan:
// - Resep punya bahan (item per ID dan/atau scrap per jenis), satu item hasil + jumlah, dan level minimum.
// - Bahan diambil dari Inventory saja. Pemain bisa craft beberapa kali sekaligus; bahan dan hasil dikalikan.
// - Resep yang levelnya belum cukup (atau dimatikan DM) tidak ditampilkan sama sekali.
// - Kapasitas dihitung selisih bersih: bahan yang terpakai membebaskan ruang, lalu hasil harus muat.
//   Bila tidak muat, pemain bisa mengirim hasilnya ke Storage.
import { itemQuarters, scrapTotal, SCRAP_TYPES, type ItemDef } from './core';
import { bundleQuarters, covers, overflow, type Bundle, type Party } from './barter';

export const MAX_CRAFT_TIMES = 99;
export const MAX_INGREDIENT_QTY = 99;
export const MAX_OUTPUT_QTY = 99;

export interface RecipeDef {
  id: string;
  name: string;
  minLevel: number;
  enabled: boolean;
  ingredients: Bundle;
  outputItemId: string;
  outputQty: number;
}

/** Resep terlihat oleh pemain hanya bila aktif dan level karakter sudah cukup. */
export const isUnlocked = (r: Pick<RecipeDef, 'minLevel' | 'enabled'>, level: number): boolean =>
  r.enabled && level >= r.minLevel;

/** Kalikan bahan dengan jumlah craft. */
export function scaleBundle(b: Bundle, times: number): Bundle {
  const scrap = { ...b.scrap };
  for (const t of SCRAP_TYPES) scrap[t] = b.scrap[t] * times;
  return { items: b.items.map((l) => ({ itemId: l.itemId, qty: l.qty * times })), scrap };
}

/** Resep tanpa bahan sama sekali tidak sah. */
export const hasIngredients = (b: Bundle): boolean => b.items.length > 0 || scrapTotal(b.scrap) > 0;

/** Berapa kali resep bisa dikerjakan dengan isi Inventory sekarang (0 bila bahan kurang atau resep tanpa bahan). */
export function maxCraftable(party: Party, ingredients: Bundle): number {
  if (!hasIngredients(ingredients)) return 0;
  let max = MAX_CRAFT_TIMES;
  for (const l of ingredients.items) max = Math.min(max, Math.floor((party.items.get(l.itemId) ?? 0) / l.qty));
  for (const t of SCRAP_TYPES) {
    if (ingredients.scrap[t] > 0) max = Math.min(max, Math.floor(party.scrap[t] / ingredients.scrap[t]));
  }
  return Math.max(0, max);
}

export type CraftCheck =
  | { ok: true; netQ: number }
  | { ok: false; reason: 'invalid' | 'missing' | 'unknown_item' }
  | { ok: false; reason: 'no_room'; overQ: number };

export interface CraftInput {
  recipe: Pick<RecipeDef, 'ingredients' | 'outputItemId' | 'outputQty'>;
  times: number;
  party: Party;
  defs: Map<string, ItemDef>;
  /** Hasil dikirim ke Storage: tidak butuh ruang di Inventory. */
  toStorage?: boolean;
}

export function checkCraft({ recipe, times, party, defs, toStorage = false }: CraftInput): CraftCheck {
  if (!Number.isInteger(times) || times < 1 || times > MAX_CRAFT_TIMES) return { ok: false, reason: 'invalid' };
  if (!hasIngredients(recipe.ingredients)) return { ok: false, reason: 'invalid' };

  const needed = scaleBundle(recipe.ingredients, times);
  const outDef = defs.get(recipe.outputItemId);
  const ingQ = bundleQuarters(needed, defs);
  if (!outDef || ingQ === null) return { ok: false, reason: 'unknown_item' };
  if (!covers(party, needed)) return { ok: false, reason: 'missing' };

  const netQ = itemQuarters(outDef) * recipe.outputQty * times - ingQ;
  if (!toStorage) {
    const over = overflow(party, netQ);
    if (over > 0) return { ok: false, reason: 'no_room', overQ: over };
  }
  return { ok: true, netQ };
}

const yieldTotal = (d: ItemDef): number => scrapTotal(d.yield);

/** Nilai scrap bahan: scrap langsung + yield tiap item bahan (bila di-breakdown). */
export function ingredientScrapValue(b: Bundle, defs: Map<string, ItemDef>): number {
  return scrapTotal(b.scrap) + b.items.reduce((sum, l) => sum + (defs.get(l.itemId) ? yieldTotal(defs.get(l.itemId)!) * l.qty : 0), 0);
}

/**
 * Peringatan untuk DM: bila hasil (Junk) bisa di-breakdown jadi scrap lebih banyak dari nilai bahannya,
 * pemain bisa craft lalu breakdown berulang untuk menambah scrap. Null bila aman.
 */
export function breakdownLoopWarning(
  recipe: Pick<RecipeDef, 'ingredients' | 'outputItemId' | 'outputQty'>,
  defs: Map<string, ItemDef>,
): string | null {
  const out = defs.get(recipe.outputItemId);
  if (!out) return null;
  const gain = yieldTotal(out) * recipe.outputQty;
  const cost = ingredientScrapValue(recipe.ingredients, defs);
  if (gain > cost) {
    return `Breaking down the result gives ${gain} scrap, more than the ${cost} scrap in the ingredients. Players could craft and break down to gain scrap.`;
  }
  return null;
}
