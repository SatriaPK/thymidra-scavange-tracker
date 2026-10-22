'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import { scrapTotal, type ItemDef } from '@/lib/core';
import { describeBundle, roomShortfallText, type Bundle } from '@/lib/barter';
import { checkCraft, isUnlocked, MAX_CRAFT_TIMES, scaleBundle } from '@/lib/crafting';
import { loadItemsById, partyFrom } from '@/lib/barter-data';
import { toRecipeDef } from '@/lib/recipe-data';
import { changeHolding, changeScrap, loadInventory, toItemDef, writeLog, type Location } from '@/lib/inventory';
import type { Recipe, RecipeItem } from '@/lib/types';

const CRAFTING = '/play/crafting';
const uuid = z.string().uuid();

type Undo = () => Promise<unknown>;

/** Ambil bahan dari Inventory; setiap langkah yang berhasil dicatat di `undo`. */
async function consume(charId: string, b: Bundle, undo: Undo[]): Promise<boolean> {
  for (const l of b.items) {
    if (!(await changeHolding(charId, l.itemId, 'inventory', -l.qty))) return false;
    undo.push(() => changeHolding(charId, l.itemId, 'inventory', l.qty));
  }
  if (scrapTotal(b.scrap) > 0) {
    const neg = { bio: -b.scrap.bio, arcane: -b.scrap.arcane, mech: -b.scrap.mech, ferrous: -b.scrap.ferrous };
    if (!(await changeScrap(charId, 'inventory', neg))) return false;
    undo.push(() => changeScrap(charId, 'inventory', b.scrap));
  }
  return true;
}

/** Craft `times` kali. `dest` = tempat hasil disimpan ("inventory" atau "storage"). */
export async function craft(recipeId: string, formData: FormData) {
  const me = await requirePlayer();
  if (!me.setup_done) go('/play/setup', 'error', 'Fill in your character first.');
  if (!uuid.safeParse(recipeId).success) go(CRAFTING, 'error', 'Recipe not found.');

  const times = Math.floor(Number(formData.get('times') ?? 1));
  const dest: Location = formData.get('dest') === 'storage' ? 'storage' : 'inventory';
  if (!Number.isInteger(times) || times < 1 || times > MAX_CRAFT_TIMES) go(CRAFTING, 'error', 'Choose how many to craft.');

  // Resep yang levelnya belum cukup diperlakukan seperti tidak ada.
  const { data } = await db().from('recipe').select('*').eq('id', recipeId).eq('campaign_id', me.campaign_id).maybeSingle();
  const row = data as Recipe | null;
  if (!row) go(CRAFTING, 'error', 'Recipe not found.');
  const { data: lines } = await db().from('recipe_item').select('*').eq('recipe_id', row.id);
  const recipe = toRecipeDef(row, (lines ?? []) as RecipeItem[]);
  if (!isUnlocked(recipe, me.level)) go(CRAFTING, 'error', 'Recipe not found.');

  const items = await loadItemsById([recipe.outputItemId, ...recipe.ingredients.items.map((l) => l.itemId)]);
  const defs = new Map<string, ItemDef>([...items].map(([id, item]) => [id, toItemDef(item)]));
  const names = new Map([...items].map(([id, item]) => [id, item.name]));

  const inv = await loadInventory(me);
  const check = checkCraft({ recipe, times, party: partyFrom(inv), defs, toStorage: dest === 'storage' });
  if (!check.ok) {
    if (check.reason === 'missing') go(CRAFTING, 'error', 'You do not have enough materials in your Inventory.');
    if (check.reason === 'unknown_item') go(CRAFTING, 'error', 'This recipe uses an item that no longer exists. Tell your DM.');
    if (check.reason === 'no_room') go(CRAFTING, 'error', `Not enough Inventory space (${roomShortfallText(check.overQ)}). Free some room or send the result to Storage.`);
    go(CRAFTING, 'error', 'Could not craft that.');
  }

  const needed = scaleBundle(recipe.ingredients, times);
  const total = recipe.outputQty * times;
  const undo: Undo[] = [];
  let ok = await consume(me.id, needed, undo);
  if (ok) {
    ok = await changeHolding(me.id, recipe.outputItemId, dest, total);
    if (ok) undo.push(() => changeHolding(me.id, recipe.outputItemId, dest, -total));
  }
  if (!ok) {
    for (const step of undo.reverse()) await step();
    revalidatePath(CRAFTING);
    go(CRAFTING, 'error', 'Could not craft. Nothing was changed. Try again.');
  }

  const outName = names.get(recipe.outputItemId) ?? 'item';
  await writeLog(me, 'craft', {
    recipe: { id: row.id, no: row.recipe_no, name: row.name },
    times,
    consumed: describeBundle(needed, names),
    output: { item_id: recipe.outputItemId, name: outName, qty: total },
    dest,
  });

  for (const p of ['/play', CRAFTING, '/play/inventory', '/play/storage']) revalidatePath(p);
  go(CRAFTING, 'ok', `Crafted ${total}x ${outName}${dest === 'storage' ? ' (sent to Storage)' : ''}.`);
}

