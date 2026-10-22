import 'server-only';
import { db } from './db';
import { itemCategory, itemHasYield } from './item';
import { emptyBundle, type Bundle } from './barter';
import type { RecipeDef } from './crafting';
import type { RecipePickerItem } from '@/components/RecipeForm';
import type { Item, Recipe, RecipeItem } from './types';

/** Semua resep campaign beserta baris bahan itemnya. */
export async function loadRecipes(campaignId: string): Promise<{ recipes: Recipe[]; lines: RecipeItem[] }> {
  const { data } = await db().from('recipe').select('*').eq('campaign_id', campaignId).order('recipe_no');
  const recipes = (data ?? []) as Recipe[];
  if (recipes.length === 0) return { recipes, lines: [] };
  const { data: lines } = await db().from('recipe_item').select('*').in('recipe_id', recipes.map((r) => r.id));
  return { recipes, lines: (lines ?? []) as RecipeItem[] };
}

export function ingredientsOf(r: Recipe, lines: RecipeItem[]): Bundle {
  const b = emptyBundle();
  b.items = lines.filter((l) => l.recipe_id === r.id).map((l) => ({ itemId: l.item_id, qty: l.qty }));
  b.scrap = { bio: r.ing_bio, arcane: r.ing_arcane, mech: r.ing_mech, ferrous: r.ing_ferrous };
  return b;
}

export const toRecipeDef = (r: Recipe, lines: RecipeItem[]): RecipeDef => ({
  id: r.id,
  name: r.name,
  minLevel: r.min_level,
  enabled: r.enabled,
  ingredients: ingredientsOf(r, lines),
  outputItemId: r.output_item_id,
  outputQty: r.output_qty,
});

/** Semua item campaign dalam bentuk ringan untuk form resep. */
export async function loadRecipePickerItems(campaignId: string): Promise<RecipePickerItem[]> {
  const { data } = await db().from('item').select('*').eq('campaign_id', campaignId).order('item_no');
  return ((data ?? []) as Item[]).map((i) => ({
    id: i.id,
    no: i.item_no,
    name: i.name,
    category: itemCategory(i),
    slot: i.is_crafted || itemHasYield(i) ? i.slot_weight : 0,
    yield: { bio: i.yield_bio, arcane: i.yield_arcane, mech: i.yield_mech, ferrous: i.yield_ferrous },
  }));
}
