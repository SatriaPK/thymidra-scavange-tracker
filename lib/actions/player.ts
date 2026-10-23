'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { firstIssue, go } from '@/lib/flash';

const ability = z.coerce.number().int().min(1).max(30);

const characterSchema = z.object({
  class: z.string().trim().min(1, 'is required').max(40),
  level: z.coerce.number().int().min(1).max(20),
  str: ability,
  dex: ability,
  con: ability,
  int_score: ability,
  wis: ability,
  cha: ability,
  invest_bonus: z.coerce.number().int().min(-10).max(30),
  slot_bonus: z.coerce.number().int().min(-20).max(100),
});

const STAT_KEYS = [
  'class', 'level', 'str', 'dex', 'con', 'int_score', 'wis', 'cha',
  'invest_proficient', 'invest_expertise', 'invest_bonus', 'slot_bonus',
  'feature_double_slots', 'feature_reroll_nat1',
] as const;

export async function saveCharacter(formData: FormData) {
  const me = await requirePlayer();
  // Kolom bonus boleh dikosongkan di form: dianggap 0. Nama tidak bisa diubah pemain.
  const input = Object.fromEntries(formData) as Record<string, string>;
  if (input.invest_bonus === '') input.invest_bonus = '0';
  if (input.slot_bonus === '') input.slot_bonus = '0';
  const parsed = characterSchema.safeParse(input);
  if (!parsed.success) go('/play/setup', 'error', firstIssue(parsed.error));

  const proficient = formData.get('invest_proficient') === 'on';
  // Expertise hanya berlaku bila proficient.
  const expertise = proficient && formData.get('invest_expertise') === 'on';
  const next = {
    ...parsed.data,
    invest_proficient: proficient,
    invest_expertise: expertise,
    feature_double_slots: formData.get('feature_double_slots') === 'on',
    feature_reroll_nat1: formData.get('feature_reroll_nat1') === 'on',
  };

  const { error } = await db()
    .from('character')
    .update({ ...next, setup_done: true })
    .eq('id', me.id);
  if (error) go('/play/setup', 'error', 'Gagal menyimpan karakter.');

  // Catat perubahan ke log DM (stat sebelum dan sesudah).
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of STAT_KEYS) {
    before[k] = me[k];
    after[k] = next[k];
  }
  await db().from('log').insert({
    campaign_id: me.campaign_id,
    character_id: me.id,
    kind: 'stat_edit',
    payload: { first_setup: !me.setup_done, before, after },
  });

  revalidatePath('/play');
  go('/play', 'ok', 'Karakter disimpan.');
}
