import type { Item } from './types';

/** Item tanpa yield (semua 0) tidak bisa di-breakdown dan tidak memakan slot. */
export const itemHasYield = (i: Pick<Item, 'yield_bio' | 'yield_arcane' | 'yield_mech' | 'yield_ferrous'>): boolean =>
  i.yield_bio + i.yield_arcane + i.yield_mech + i.yield_ferrous > 0;
