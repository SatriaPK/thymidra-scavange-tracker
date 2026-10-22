// Format JSON untuk import/export resep crafting. Semua fungsi murni (tanpa database).
// Item dirujuk lewat ID item (001, 002, ...), sama seperti import zona.
import { z } from 'zod';
import { formatItemId, formatRecipeId, parseItemId, parseRecipeId } from './ids';
import { SCRAP_TYPES, type Scrap } from './core';
import { MAX_INGREDIENT_QTY, MAX_OUTPUT_QTY } from './crafting';
import { MAX_IMPORT_ROWS, type ParseResult } from './transfer';

export interface RecipeExportRow {
  id: string;
  name: string;
  level: number;
  enabled: boolean;
  description: string;
  output: { item: number; qty: number };
  ingredients: { items: { item: number; qty: number }[]; scrap: Scrap };
}

export interface RecipeLike {
  id: string;
  recipe_no: number;
  name: string;
  description: string | null;
  min_level: number;
  enabled: boolean;
  output_qty: number;
  ing_bio: number;
  ing_arcane: number;
  ing_mech: number;
  ing_ferrous: number;
}

export function buildRecipesExport(
  recipes: (RecipeLike & { output_item_no: number })[],
  ingredients: { recipe_id: string; item_no: number; qty: number }[],
) {
  const rows: RecipeExportRow[] = recipes
    .slice()
    .sort((a, b) => a.recipe_no - b.recipe_no)
    .map((r) => ({
      id: formatRecipeId(r.recipe_no),
      name: r.name,
      level: r.min_level,
      enabled: r.enabled,
      description: r.description ?? '',
      output: { item: r.output_item_no, qty: r.output_qty },
      ingredients: {
        items: ingredients
          .filter((i) => i.recipe_id === r.id)
          .sort((a, b) => a.item_no - b.item_no)
          .map((i) => ({ item: i.item_no, qty: i.qty })),
        scrap: { bio: r.ing_bio, arcane: r.ing_arcane, mech: r.ing_mech, ferrous: r.ing_ferrous },
      },
    }));
  return { type: 'scavenge-recipes', version: 1, recipes: rows };
}

const idField = z.union([z.number(), z.string()]);
const scrapQty = z.coerce.number().int().min(0).max(999);
const lineSchema = z.object({ item: idField, qty: z.coerce.number().int().min(1).max(MAX_INGREDIENT_QTY).optional() });

const recipeRowSchema = z.object({
  id: idField.optional(),
  name: z.string().trim().min(1, 'name is required').max(80),
  level: z.coerce.number().int().min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  description: z.string().trim().max(500).nullish(),
  output: z.object({ item: idField, qty: z.coerce.number().int().min(1).max(MAX_OUTPUT_QTY).optional() }),
  ingredients: z.object({
    items: z.array(lineSchema).max(50).optional(),
    scrap: z.object({ bio: scrapQty.optional(), arcane: scrapQty.optional(), mech: scrapQty.optional(), ferrous: scrapQty.optional() }).optional(),
  }),
});

export interface RecipeImportRow {
  no: number | null;
  name: string;
  level: number;
  enabled: boolean;
  description: string | null;
  outputItemNo: number;
  outputQty: number;
  items: { itemNo: number; qty: number }[];
  scrap: Scrap;
}

/** Menerima array resep, atau objek { recipes: [...] } hasil export. */
export function parseRecipesImport(raw: unknown): ParseResult<RecipeImportRow> {
  const list = Array.isArray(raw) ? raw : (raw as { recipes?: unknown } | null)?.recipes;
  if (!Array.isArray(list)) return { ok: false, errors: ['File must contain a "recipes" array.'] };
  if (list.length === 0) return { ok: false, errors: ['File has no recipes.'] };
  if (list.length > MAX_IMPORT_ROWS) return { ok: false, errors: [`Too many recipes (max ${MAX_IMPORT_ROWS}).`] };

  const errors: string[] = [];
  const rows: RecipeImportRow[] = [];
  const seen = new Set<number>();

  list.forEach((entry, idx) => {
    const label = `Recipe #${idx + 1}`;
    const parsed = recipeRowSchema.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`${label}: ${issue.path.join('.') || 'row'} ${issue.message}`);
      return;
    }
    const d = parsed.data;

    let no: number | null = null;
    if (d.id !== undefined && d.id !== null && d.id !== '') {
      no = parseRecipeId(d.id);
      if (no === null) {
        errors.push(`${label}: invalid id "${String(d.id)}" (expected R001)`);
        return;
      }
      if (seen.has(no)) {
        errors.push(`${label}: duplicate id ${formatRecipeId(no)} in file`);
        return;
      }
      seen.add(no);
    }

    const outputItemNo = parseItemId(d.output.item);
    if (outputItemNo === null) {
      errors.push(`${label} (${d.name}): invalid output item id "${String(d.output.item)}"`);
      return;
    }

    const items: { itemNo: number; qty: number }[] = [];
    const used = new Set<number>();
    let bad = false;
    for (const l of d.ingredients.items ?? []) {
      const itemNo = parseItemId(l.item);
      if (itemNo === null) {
        errors.push(`${label} (${d.name}): invalid ingredient item id "${String(l.item)}"`);
        bad = true;
      } else if (used.has(itemNo)) {
        errors.push(`${label} (${d.name}): ingredient ${formatItemId(itemNo)} listed twice`);
        bad = true;
      } else {
        used.add(itemNo);
        items.push({ itemNo, qty: l.qty ?? 1 });
      }
    }
    if (bad) return;

    const s = d.ingredients.scrap ?? {};
    const scrap = { bio: s.bio ?? 0, arcane: s.arcane ?? 0, mech: s.mech ?? 0, ferrous: s.ferrous ?? 0 };
    if (items.length === 0 && SCRAP_TYPES.every((t) => scrap[t] === 0)) {
      errors.push(`${label} (${d.name}): needs at least one ingredient`);
      return;
    }

    rows.push({
      no,
      name: d.name,
      level: d.level ?? 1,
      enabled: d.enabled ?? true,
      description: d.description || null,
      outputItemNo,
      outputQty: d.output.qty ?? 1,
      items,
      scrap,
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

/** ID item yang dirujuk resep (hasil atau bahan) tapi tidak ada di campaign. */
export function missingRecipeItemRefs(recipes: RecipeImportRow[], knownItemNos: Set<number>): string[] {
  const errors: string[] = [];
  recipes.forEach((r, idx) => {
    const missing = new Set<number>();
    for (const no of [r.outputItemNo, ...r.items.map((i) => i.itemNo)]) if (!knownItemNos.has(no)) missing.add(no);
    if (missing.size) errors.push(`Recipe #${idx + 1} (${r.name}): unknown item id ${[...missing].map(formatItemId).join(', ')}`);
  });
  return errors;
}
