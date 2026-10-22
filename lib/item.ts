import type { Item } from './types';

/** Item tanpa yield (semua 0) tidak bisa di-breakdown dan tidak memakan slot (kecuali Crafted). */
export const itemHasYield = (i: Pick<Item, 'yield_bio' | 'yield_arcane' | 'yield_mech' | 'yield_ferrous'>): boolean =>
  i.yield_bio + i.yield_arcane + i.yield_mech + i.yield_ferrous > 0;

export type ItemCategory = 'junk' | 'wondrous' | 'crafted';

/**
 * Junk: memakan slot, punya yield, bisa di-breakdown.
 * Wondrous: tanpa slot, tanpa yield.
 * Crafted: memakan slot, tanpa yield, tidak bisa di-breakdown (hasil crafting).
 */
export const itemCategory = (i: { is_wondrous: boolean; is_crafted?: boolean }): ItemCategory =>
  i.is_crafted ? 'crafted' : i.is_wondrous ? 'wondrous' : 'junk';

/** Pool Junk menerima Junk dan Crafted; pool Rare menerima Wondrous dan Crafted. */
export const canJoinPool = (category: ItemCategory, rare: boolean): boolean =>
  category === 'crafted' || category === (rare ? 'wondrous' : 'junk');

export const CATEGORY_LABEL: Record<ItemCategory, string> = { junk: 'Junk', wondrous: 'Wondrous', crafted: 'Crafted' };
