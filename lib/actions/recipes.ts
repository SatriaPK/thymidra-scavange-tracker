'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { firstIssue, go } from '@/lib/flash';
import { MAX_INGREDIENT_QTY, MAX_OUTPUT_QTY } from '@/lib/crafting';
import { missingRecipeItemRefs, parseRecipesImport } from '@/lib/recipe-transfer';

const BACK = '/dm/recipes';
const MAX_IMPORT_BYTES = 1_000_000;
const uuid = z.string().uuid();
const reqInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const payloadSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'is required').max(80),
  description: z.string().trim().max(500).optional(),
  level: reqInt(1, 20),
  enabled: z.boolean(),
  output_item_id: uuid,
  output_qty: reqInt(1, MAX_OUTPUT_QTY),
  scrap: z.object({ bio: reqInt(0, 999), arcane: reqInt(0, 999), mech: reqInt(0, 999), ferrous: reqInt(0, 999) }),
  items: z.array(z.object({ item_id: uuid, qty: reqInt(1, MAX_INGREDIENT_QTY) })).max(50),
});

interface Line {
  item_id: string;
  qty: number;
}

async function nextRecipeNo(campaignId: string): Promise<number> {
  const { data } = await db()
    .from('recipe')
    .select('recipe_no')
    .eq('campaign_id', campaignId)
    .order('recipe_no', { ascending: false })
    .limit(1);
  return ((data?.[0]?.recipe_no as number | undefined) ?? 0) + 1;
}

/**
 * Samakan recipe_item dengan daftar baru. Tambah/ubah dulu, baru hapus yang sudah tidak ada,
 * supaya kegagalan di tengah jalan tidak mengosongkan bahan resep.
 */
async function syncRecipeItems(recipeId: string, lines: Line[]): Promise<boolean> {
  if (lines.length > 0) {
    const rows = lines.map((l) => ({ recipe_id: recipeId, item_id: l.item_id, qty: l.qty }));
    const { error } = await db().from('recipe_item').upsert(rows, { onConflict: 'recipe_id,item_id' });
    if (error) return false;
  }
  const keep = new Set(lines.map((l) => l.item_id));
  const { data: current } = await db().from('recipe_item').select('item_id').eq('recipe_id', recipeId);
  for (const c of (current ?? []) as { item_id: string }[]) {
    if (!keep.has(c.item_id)) await db().from('recipe_item').delete().eq('recipe_id', recipeId).eq('item_id', c.item_id);
  }
  return true;
}

function refresh() {
  revalidatePath(BACK);
  revalidatePath('/play/crafting');
}

// ======================= Simpan =======================

export async function saveRecipe(formData: FormData) {
  const campaign = await requireDm();

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get('payload') ?? ''));
  } catch {
    go(BACK, 'error', 'Invalid form data. Reload the page and try again.');
  }
  const idHint = (input as { id?: unknown } | null)?.id;
  const back = typeof idHint === 'string' && uuid.safeParse(idHint).success ? `${BACK}/${idHint}` : `${BACK}/new`;

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) go(back, 'error', firstIssue(parsed.error));
  const d = parsed.data;

  const hasScrap = d.scrap.bio + d.scrap.arcane + d.scrap.mech + d.scrap.ferrous > 0;
  if (d.items.length === 0 && !hasScrap) go(back, 'error', 'Add at least one ingredient (scrap or an item).');
  if (new Set(d.items.map((l) => l.item_id)).size !== d.items.length) go(back, 'error', 'An item is listed twice in the ingredients.');

  // Hasil dan semua bahan harus item milik campaign ini.
  const itemIds = [...new Set([d.output_item_id, ...d.items.map((l) => l.item_id)])];
  const { data: found } = await db().from('item').select('id').eq('campaign_id', campaign.id).in('id', itemIds);
  if ((found ?? []).length !== itemIds.length) go(back, 'error', 'Some items no longer exist. Reload the page.');

  const row = {
    name: d.name,
    description: d.description || null,
    min_level: d.level,
    enabled: d.enabled,
    output_item_id: d.output_item_id,
    output_qty: d.output_qty,
    ing_bio: d.scrap.bio,
    ing_arcane: d.scrap.arcane,
    ing_mech: d.scrap.mech,
    ing_ferrous: d.scrap.ferrous,
  };

  let recipeId = d.id ?? '';
  if (recipeId) {
    const { data, error } = await db().from('recipe').update(row).eq('id', recipeId).eq('campaign_id', campaign.id).select('id');
    if (error || (data ?? []).length !== 1) go(back, 'error', 'Could not save the recipe.');
  } else {
    const { data, error } = await db()
      .from('recipe')
      .insert({ ...row, campaign_id: campaign.id, recipe_no: await nextRecipeNo(campaign.id) })
      .select('id')
      .single();
    if (error || !data) go(back, 'error', 'Could not create the recipe.');
    recipeId = data.id as string;
  }

  if (!(await syncRecipeItems(recipeId, d.items))) {
    go(`${BACK}/${recipeId}`, 'error', 'Recipe saved, but its ingredients could not be saved. Try again.');
  }

  refresh();
  go(BACK, 'ok', `Recipe "${d.name}" saved.`);
}

// ======================= Hapus =======================

export async function deleteRecipes(formData: FormData) {
  const campaign = await requireDm();
  const ids = formData.getAll('ids').map(String).filter((v) => uuid.safeParse(v).success);
  if (ids.length === 0) go(BACK, 'error', 'No recipes selected.');
  await db().from('recipe').delete().eq('campaign_id', campaign.id).in('id', ids);
  refresh();
  go(BACK, 'ok', `${ids.length} recipe${ids.length === 1 ? '' : 's'} deleted.`);
}

// ======================= Import =======================

export async function importRecipes(formData: FormData) {
  const campaign = await requireDm();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) go(BACK, 'error', 'Choose a JSON file first.');
  if (file.size > MAX_IMPORT_BYTES) go(BACK, 'error', 'File is too large (max 1 MB).');
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    go(BACK, 'error', 'File is not valid JSON.');
  }

  const parsed = parseRecipesImport(json);
  if (!parsed.ok) {
    const shown = parsed.errors.slice(0, 3).join(' | ');
    go(BACK, 'error', parsed.errors.length > 3 ? `${shown} (+${parsed.errors.length - 3} more)` : shown);
  }

  const { data: items } = await db().from('item').select('id,item_no').eq('campaign_id', campaign.id);
  const itemIdByNo = new Map(((items ?? []) as { id: string; item_no: number }[]).map((i) => [i.item_no, i.id]));
  const missing = missingRecipeItemRefs(parsed.rows, new Set(itemIdByNo.keys()));
  if (missing.length > 0) go(BACK, 'error', `${missing.slice(0, 3).join(' | ')}. Import the items first.`);

  const { data: existing } = await db().from('recipe').select('recipe_no').eq('campaign_id', campaign.id);
  const existingNos = new Set(((existing ?? []) as { recipe_no: number }[]).map((r) => r.recipe_no));
  let next = Math.max(0, ...existingNos, ...parsed.rows.map((r) => r.no ?? 0));

  const rows = parsed.rows.map((r) => ({
    campaign_id: campaign.id,
    recipe_no: r.no ?? ++next,
    name: r.name,
    description: r.description,
    min_level: r.level,
    enabled: r.enabled,
    output_item_id: itemIdByNo.get(r.outputItemNo)!,
    output_qty: r.outputQty,
    ing_bio: r.scrap.bio,
    ing_arcane: r.scrap.arcane,
    ing_mech: r.scrap.mech,
    ing_ferrous: r.scrap.ferrous,
  }));
  const { data: saved, error } = await db().from('recipe').upsert(rows, { onConflict: 'campaign_id,recipe_no' }).select('id,recipe_no');
  if (error || !saved) go(BACK, 'error', 'Import failed. No recipes were changed.');

  const idByNo = new Map((saved as { id: string; recipe_no: number }[]).map((r) => [r.recipe_no, r.id]));
  let failed = 0;
  for (let i = 0; i < parsed.rows.length; i++) {
    const recipeId = idByNo.get(rows[i].recipe_no);
    const lines = parsed.rows[i].items.map((l) => ({ item_id: itemIdByNo.get(l.itemNo)!, qty: l.qty }));
    if (!recipeId || !(await syncRecipeItems(recipeId, lines))) failed++;
  }

  const created = rows.filter((r) => !existingNos.has(r.recipe_no)).length;
  refresh();
  if (failed > 0) go(BACK, 'error', `Import done, but ${failed} recipe(s) could not fill their ingredients. Import again.`);
  go(BACK, 'ok', `Import done: ${created} new, ${rows.length - created} updated.`);
}
