import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { formatRecipeId } from '@/lib/ids';
import { loadRecipePickerItems } from '@/lib/recipe-data';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import { RecipeForm } from '@/components/RecipeForm';
import type { Recipe, RecipeItem } from '@/lib/types';

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const campaign = await requireDm();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const { data } = await db().from('recipe').select('*').eq('id', id).eq('campaign_id', campaign.id).maybeSingle();
  if (!data) notFound();
  const recipe = data as Recipe;
  const { data: lines } = await db().from('recipe_item').select('*').eq('recipe_id', recipe.id);
  const items = await loadRecipePickerItems(campaign.id);

  return (
    <>
      <Header title="Recipes" />
      <SubHeader back="/dm/recipes" title="Edit Recipe" right={`ID: ${formatRecipeId(recipe.recipe_no)}`} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <RecipeForm
        items={items}
        initial={{
          id: recipe.id,
          name: recipe.name,
          description: recipe.description ?? '',
          level: String(recipe.min_level),
          enabled: recipe.enabled,
          outputItemId: recipe.output_item_id,
          outputQty: String(recipe.output_qty),
          scrap: {
            arcane: String(recipe.ing_arcane),
            bio: String(recipe.ing_bio),
            ferrous: String(recipe.ing_ferrous),
            mech: String(recipe.ing_mech),
          },
          items: ((lines ?? []) as RecipeItem[]).map((l) => ({ item_id: l.item_id, qty: String(l.qty) })),
        }}
      />
    </>
  );
}
