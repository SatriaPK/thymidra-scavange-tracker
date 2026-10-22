import { describe, expect, it } from 'vitest';
import { formatRecipeId, parseRecipeId } from './ids';
import { buildRecipesExport, missingRecipeItemRefs, parseRecipesImport } from './recipe-transfer';

const valid = {
  id: 'R001',
  name: 'Pedang Besi',
  level: 3,
  output: { item: '012', qty: 2 },
  ingredients: { items: [{ item: 1, qty: 2 }], scrap: { mech: 4 } },
};

describe('ID resep', () => {
  it('format R001 dan parse bolak-balik', () => {
    expect(formatRecipeId(1)).toBe('R001');
    expect(formatRecipeId(42)).toBe('R042');
    expect(formatRecipeId(1234)).toBe('R1234');
    for (const n of [1, 9, 10, 999, 1000]) expect(parseRecipeId(formatRecipeId(n))).toBe(n);
    expect(parseRecipeId('r7')).toBe(7);
    expect(parseRecipeId(5)).toBe(5);
  });

  it('parse menolak input aneh', () => {
    for (const v of ['', 'R', 'Rabc', 'R0', 0, -1, 1.5, 'AAA']) expect(parseRecipeId(v)).toBeNull();
  });
});

describe('import resep', () => {
  it('menerima array biasa dan objek hasil export', () => {
    expect(parseRecipesImport([valid]).ok).toBe(true);
    expect(parseRecipesImport({ recipes: [valid] }).ok).toBe(true);
  });

  it('nilai default: level 1, aktif, hasil x1, bahan item x1', () => {
    const r = parseRecipesImport([{ name: 'X', output: { item: 1 }, ingredients: { items: [{ item: 2 }] } }]);
    expect(r.ok && r.rows[0]).toMatchObject({ level: 1, enabled: true, outputQty: 1, items: [{ itemNo: 2, qty: 1 }], no: null });
  });

  it('bahan gabungan item + scrap terbaca', () => {
    const r = parseRecipesImport([valid]);
    expect(r.ok && r.rows[0]).toMatchObject({
      no: 1,
      level: 3,
      outputItemNo: 12,
      outputQty: 2,
      items: [{ itemNo: 1, qty: 2 }],
      scrap: { bio: 0, arcane: 0, mech: 4, ferrous: 0 },
    });
  });

  it('hanya scrap atau hanya item sama-sama sah', () => {
    expect(parseRecipesImport([{ name: 'A', output: { item: 1 }, ingredients: { scrap: { bio: 1 } } }]).ok).toBe(true);
    expect(parseRecipesImport([{ name: 'A', output: { item: 1 }, ingredients: { items: [{ item: 2 }] } }]).ok).toBe(true);
  });

  it('menolak resep tanpa bahan', () => {
    expect(parseRecipesImport([{ name: 'A', output: { item: 1 }, ingredients: {} }]).ok).toBe(false);
    expect(parseRecipesImport([{ name: 'A', output: { item: 1 }, ingredients: { scrap: { bio: 0 }, items: [] } }]).ok).toBe(false);
  });

  it('menolak level di luar 1-20, jumlah 0, id item tak valid, bahan kembar, id resep kembar', () => {
    const base = { name: 'A', output: { item: 1 }, ingredients: { scrap: { bio: 1 } } };
    expect(parseRecipesImport([{ ...base, level: 0 }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, level: 21 }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, output: { item: 1, qty: 0 } }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, output: { item: 'abc' } }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, ingredients: { items: [{ item: 2 }, { item: '002' }] } }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, id: 'R001' }, { ...base, id: 'r1' }]).ok).toBe(false);
    expect(parseRecipesImport([{ ...base, id: 'XYZ' }]).ok).toBe(false);
  });

  it('menolak file kosong atau bentuk salah', () => {
    expect(parseRecipesImport([]).ok).toBe(false);
    expect(parseRecipesImport({}).ok).toBe(false);
    expect(parseRecipesImport(null).ok).toBe(false);
  });

  it('missingRecipeItemRefs mencari item hasil dan bahan yang tidak ada', () => {
    const r = parseRecipesImport([valid]);
    if (!r.ok) throw new Error('parse failed');
    expect(missingRecipeItemRefs(r.rows, new Set([1, 12]))).toEqual([]);
    expect(missingRecipeItemRefs(r.rows, new Set([1]))[0]).toMatch(/unknown item id 012/);
    expect(missingRecipeItemRefs(r.rows, new Set())[0]).toMatch(/001, 012|012, 001/);
  });

  it('export lalu import memberi data yang sama', () => {
    const exported = buildRecipesExport(
      [
        { id: 'b', recipe_no: 2, name: 'Ramuan', description: null, min_level: 1, enabled: false, output_item_no: 5, output_qty: 3, ing_bio: 2, ing_arcane: 0, ing_mech: 0, ing_ferrous: 0 },
        { id: 'a', recipe_no: 1, name: 'Pedang', description: 'Tajam', min_level: 5, enabled: true, output_item_no: 12, output_qty: 1, ing_bio: 0, ing_arcane: 0, ing_mech: 4, ing_ferrous: 0 },
      ],
      [
        { recipe_id: 'a', item_no: 3, qty: 1 },
        { recipe_id: 'a', item_no: 1, qty: 2 },
      ],
    );
    expect(exported.recipes.map((r) => r.id)).toEqual(['R001', 'R002']);
    expect(exported.recipes[0].ingredients.items).toEqual([{ item: 1, qty: 2 }, { item: 3, qty: 1 }]);
    const back = parseRecipesImport(JSON.parse(JSON.stringify(exported)));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.rows[0]).toMatchObject({ no: 1, name: 'Pedang', level: 5, description: 'Tajam', outputItemNo: 12, scrap: { mech: 4 } });
      expect(back.rows[1]).toMatchObject({ no: 2, enabled: false, outputQty: 3, scrap: { bio: 2 } });
    }
  });
});
