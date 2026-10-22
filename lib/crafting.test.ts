import { describe, expect, it } from 'vitest';
import { emptyScrap, type ItemDef, type Scrap } from './core';
import type { Bundle, Party } from './barter';
import {
  breakdownLoopWarning,
  checkCraft,
  hasIngredients,
  ingredientScrapValue,
  isUnlocked,
  maxCraftable,
  scaleBundle,
  type RecipeDef,
} from './crafting';

const scrap = (s: Partial<Scrap> = {}): Scrap => ({ ...emptyScrap(), ...s });
const bundle = (items: [string, number][] = [], s: Partial<Scrap> = {}): Bundle => ({
  items: items.map(([itemId, qty]) => ({ itemId, qty })),
  scrap: scrap(s),
});
const party = (items: [string, number][], s: Partial<Scrap>, usedQ: number, capacitySlots: number): Party => ({
  items: new Map(items),
  scrap: scrap(s),
  usedQ,
  capacityQ: capacitySlots * 4,
});

const gear: ItemDef = { id: 'gear', name: 'Gear', slotWeight: 2, yield: scrap({ mech: 3 }) }; // 2 slot = 8q, yield 3
const kerang: ItemDef = { id: 'kerang', name: 'Kerang', slotWeight: 1, yield: scrap({ bio: 2 }) }; // 1 slot = 4q, yield 2
const pedang: ItemDef = { id: 'pedang', name: 'Pedang', slotWeight: 3, yield: emptyScrap(), crafted: true }; // 3 slot = 12q
const ramuan: ItemDef = { id: 'ramuan', name: 'Ramuan', slotWeight: 0, yield: emptyScrap() }; // wondrous: 0q
const defs = new Map([gear, kerang, pedang, ramuan].map((d) => [d.id, d]));

const recipe = (over: Partial<RecipeDef> = {}): RecipeDef => ({
  id: 'r1',
  name: 'Pedang Besi',
  minLevel: 1,
  enabled: true,
  ingredients: bundle([['gear', 1]], { mech: 4 }), // 8q + 4q = 12q per craft
  outputItemId: 'pedang',
  outputQty: 1,
  ...over,
});

describe('visibilitas resep (level)', () => {
  it('terlihat hanya bila aktif dan level cukup', () => {
    expect(isUnlocked({ minLevel: 3, enabled: true }, 2)).toBe(false);
    expect(isUnlocked({ minLevel: 3, enabled: true }, 3)).toBe(true);
    expect(isUnlocked({ minLevel: 3, enabled: true }, 10)).toBe(true);
    expect(isUnlocked({ minLevel: 1, enabled: false }, 20)).toBe(false);
  });
});

describe('scaleBundle dan maxCraftable', () => {
  it('scaleBundle mengalikan item dan scrap', () => {
    expect(scaleBundle(bundle([['gear', 2]], { bio: 3, mech: 1 }), 3)).toEqual(bundle([['gear', 6]], { bio: 9, mech: 3 }));
  });

  it('maxCraftable = batas terkecil dari semua bahan', () => {
    const p = party([['gear', 5]], { mech: 9 }, 0, 20);
    // gear: 5, mech: floor(9/4) = 2
    expect(maxCraftable(p, recipe().ingredients)).toBe(2);
    expect(maxCraftable(party([['gear', 5]], { mech: 3 }, 0, 20), recipe().ingredients)).toBe(0);
    expect(maxCraftable(party([], { mech: 99 }, 0, 20), recipe().ingredients)).toBe(0);
  });

  it('maxCraftable dibatasi 99 dan 0 bila resep tanpa bahan', () => {
    expect(maxCraftable(party([], { bio: 9999 }, 0, 20), bundle([], { bio: 1 }))).toBe(99);
    expect(maxCraftable(party([], {}, 0, 20), bundle())).toBe(0);
    expect(hasIngredients(bundle())).toBe(false);
  });
});

describe('checkCraft', () => {
  const ok = party([['gear', 3]], { mech: 12 }, 20, 10); // kapasitas 40q, terpakai 20q

  it('berhasil bila bahan cukup dan hasil muat', () => {
    expect(checkCraft({ recipe: recipe(), times: 1, party: ok, defs })).toEqual({ ok: true, netQ: 0 });
  });

  it('bahan kurang: missing', () => {
    expect(checkCraft({ recipe: recipe(), times: 4, party: ok, defs })).toEqual({ ok: false, reason: 'missing' });
    expect(checkCraft({ recipe: recipe(), times: 1, party: party([['gear', 1]], { mech: 3 }, 0, 10), defs })).toEqual({ ok: false, reason: 'missing' });
  });

  it('jumlah craft tidak valid', () => {
    for (const times of [0, -1, 1.5, 100, NaN]) {
      expect(checkCraft({ recipe: recipe(), times, party: ok, defs })).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('selisih bersih: bahan melepas ruang, jadi tetap muat walau Inventory penuh', () => {
    // penuh 40/40; bahan 12q dilepas, hasil 12q masuk -> net 0
    const full = party([['gear', 1]], { mech: 4 }, 40, 10);
    expect(checkCraft({ recipe: recipe(), times: 1, party: full, defs })).toEqual({ ok: true, netQ: 0 });
  });

  it('hasil lebih besar dari bahan: kurang ruang, melaporkan kekurangannya', () => {
    const r = recipe({ outputQty: 2 }); // hasil 24q, bahan 12q -> net +12
    const tight = party([['gear', 1]], { mech: 4 }, 36, 10); // sisa 4q
    expect(checkCraft({ recipe: r, times: 1, party: tight, defs })).toEqual({ ok: false, reason: 'no_room', overQ: 8 });
  });

  it('craft banyak dikalikan: x3 butuh 36q hasil', () => {
    const rich = party([['gear', 3]], { mech: 12 }, 0, 10);
    expect(checkCraft({ recipe: recipe(), times: 3, party: rich, defs })).toEqual({ ok: true, netQ: 0 });
    const r = recipe({ ingredients: bundle([], { bio: 1 }) }); // bahan 1q, hasil 12q per craft
    expect(checkCraft({ recipe: r, times: 3, party: party([], { bio: 3 }, 30, 10), defs })).toEqual({ ok: false, reason: 'no_room', overQ: 30 + 33 - 40 });
  });

  it('kirim ke Storage: tidak butuh ruang di Inventory', () => {
    const r = recipe({ ingredients: bundle([], { bio: 1 }) });
    const full = party([], { bio: 1 }, 40, 10);
    expect(checkCraft({ recipe: r, times: 1, party: full, defs }).ok).toBe(false);
    expect(checkCraft({ recipe: r, times: 1, party: full, defs, toStorage: true }).ok).toBe(true);
  });

  it('hasil Wondrous tidak butuh ruang', () => {
    const r = recipe({ ingredients: bundle([], { bio: 1 }), outputItemId: 'ramuan' });
    expect(checkCraft({ recipe: r, times: 5, party: party([], { bio: 5 }, 40, 10), defs }).ok).toBe(true);
  });

  it('item hasil atau bahan yang sudah tidak ada: unknown_item', () => {
    expect(checkCraft({ recipe: recipe({ outputItemId: 'hilang' }), times: 1, party: ok, defs })).toEqual({ ok: false, reason: 'unknown_item' });
    const r = recipe({ ingredients: bundle([['hilang', 1]]) });
    expect(checkCraft({ recipe: r, times: 1, party: party([['hilang', 1]], {}, 0, 10), defs })).toEqual({ ok: false, reason: 'unknown_item' });
  });

  it('resep tanpa bahan tidak sah', () => {
    expect(checkCraft({ recipe: recipe({ ingredients: bundle() }), times: 1, party: ok, defs })).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('peringatan loop breakdown untuk DM', () => {
  it('nilai bahan = scrap langsung + yield item bahan', () => {
    expect(ingredientScrapValue(bundle([['gear', 2]], { bio: 1 }), defs)).toBe(2 * 3 + 1);
  });

  it('hasil Junk dengan yield lebih besar dari bahan: ada peringatan', () => {
    const r = recipe({ ingredients: bundle([], { bio: 1 }), outputItemId: 'gear', outputQty: 1 }); // gain 3 > cost 1
    expect(breakdownLoopWarning(r, defs)).toMatch(/3 scrap.*1 scrap/);
  });

  it('aman bila yield hasil <= bahan, atau hasil Crafted/Wondrous (tanpa yield)', () => {
    expect(breakdownLoopWarning(recipe({ ingredients: bundle([], { bio: 3 }), outputItemId: 'gear' }), defs)).toBeNull(); // 3 <= 3
    expect(breakdownLoopWarning(recipe(), defs)).toBeNull(); // crafted
    expect(breakdownLoopWarning(recipe({ outputItemId: 'ramuan' }), defs)).toBeNull();
    expect(breakdownLoopWarning(recipe({ outputItemId: 'hilang' }), defs)).toBeNull();
  });

  it('jumlah hasil ikut dihitung', () => {
    const r = recipe({ ingredients: bundle([], { bio: 5 }), outputItemId: 'kerang', outputQty: 3 }); // gain 6 > 5
    expect(breakdownLoopWarning(r, defs)).not.toBeNull();
  });
});
