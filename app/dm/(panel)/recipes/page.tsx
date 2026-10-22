import Link from 'next/link';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { deleteRecipes, importRecipes } from '@/lib/actions/recipes';
import { describeBundle } from '@/lib/barter';
import { formatRecipeId } from '@/lib/ids';
import { ingredientsOf, loadRecipes } from '@/lib/recipe-data';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { DownloadIcon, PlusIcon } from '@/components/Icons';
import { ImportButton } from '@/components/ImportButton';
import { SelectableList, type ListRow } from '@/components/SelectableList';

export default async function RecipesPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;
  const { recipes, lines } = await loadRecipes(campaign.id);

  const { data } = await db().from('item').select('id,name').eq('campaign_id', campaign.id);
  const names = new Map(((data ?? []) as { id: string; name: string }[]).map((i) => [i.id, i.name]));

  const rows: ListRow[] = recipes.map((r) => {
    const ingredients = describeBundle(ingredientsOf(r, lines), names);
    const result = `${r.output_qty}x ${names.get(r.output_item_id) ?? 'Unknown item'}`;
    return {
      id: r.id,
      title: r.name,
      tag: `Lv ${r.min_level}`,
      sub: `${ingredients} → ${result}`,
      idLabel: `ID: ${formatRecipeId(r.recipe_no)}`,
      editHref: `/dm/recipes/${r.id}`,
      description: r.description ?? '',
      details: [
        ['Level', String(r.min_level)],
        ['Result', result],
        ['Ingredients', ingredients],
        ['Status', r.enabled ? 'Enabled' : 'Disabled'],
      ],
    };
  });

  return (
    <>
      <Header title="Recipes" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        <div className="sec-head">
          <h2>Recipe Book</h2>
          <span className="count">{recipes.length} Recipe</span>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/dm/recipes/new"><PlusIcon /> New Recipe</Link>
          <ImportButton action={importRecipes} label="Import recipes (JSON)" />
          <a className="icon-btn" href="/dm/recipes/export" aria-label="Export all recipes" title="Export all recipes">
            <DownloadIcon />
          </a>
        </div>
        <SelectableList
          rows={rows}
          entity="Recipe"
          searchPlaceholder="Search recipe..."
          deleteAction={deleteRecipes}
          exportHref="/dm/recipes/export"
          emptyText="No recipes yet. Create one or import a JSON file."
        />
      </section>
    </>
  );
}
