import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { wibDay } from '@/lib/core';
import { idsParam, jsonDownload } from '@/lib/download';
import { buildRecipesExport } from '@/lib/recipe-transfer';
import type { Item, Recipe, RecipeItem } from '@/lib/types';

export async function GET(request: Request) {
  const campaign = await requireDm();
  const ids = idsParam(request);

  let query = db().from('recipe').select('*').eq('campaign_id', campaign.id).order('recipe_no');
  if (ids) query = query.in('id', ids);
  const recipes = ((await query).data ?? []) as Recipe[];

  const recipeIds = recipes.map((r) => r.id);
  const [itemsRes, linesRes] = await Promise.all([
    db().from('item').select('id,item_no').eq('campaign_id', campaign.id),
    recipeIds.length ? db().from('recipe_item').select('*').in('recipe_id', recipeIds) : Promise.resolve({ data: [] }),
  ]);
  const itemNoById = new Map(((itemsRes.data ?? []) as Pick<Item, 'id' | 'item_no'>[]).map((i) => [i.id, i.item_no]));

  const withOutput = recipes.flatMap((r) => {
    const no = itemNoById.get(r.output_item_id);
    return no === undefined ? [] : [{ ...r, output_item_no: no }];
  });
  const lines = ((linesRes.data ?? []) as RecipeItem[]).flatMap((l) => {
    const no = itemNoById.get(l.item_id);
    return no === undefined ? [] : [{ recipe_id: l.recipe_id, item_no: no, qty: l.qty }];
  });

  return jsonDownload(`recipes-${wibDay(new Date())}.json`, buildRecipesExport(withOutput, lines));
}
