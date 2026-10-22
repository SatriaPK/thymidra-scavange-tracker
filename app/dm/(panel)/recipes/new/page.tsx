import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { formatRecipeId } from '@/lib/ids';
import { loadRecipePickerItems } from '@/lib/recipe-data';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import { RecipeForm } from '@/components/RecipeForm';

export default async function NewRecipePage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  // Perkiraan ID berikutnya; nomor pastinya diberikan saat disimpan.
  const { data } = await db()
    .from('recipe')
    .select('recipe_no')
    .eq('campaign_id', campaign.id)
    .order('recipe_no', { ascending: false })
    .limit(1);
  const next = ((data?.[0]?.recipe_no as number | undefined) ?? 0) + 1;
  const items = await loadRecipePickerItems(campaign.id);

  return (
    <>
      <Header title="Recipes" />
      <SubHeader back="/dm/recipes" title="New Recipe" right={`ID: ${formatRecipeId(next)}`} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <RecipeForm
        items={items}
        initial={{
          name: '',
          description: '',
          level: '1',
          enabled: true,
          outputItemId: '',
          outputQty: '1',
          scrap: { arcane: '0', bio: '0', ferrous: '0', mech: '0' },
          items: [],
        }}
      />
    </>
  );
}
