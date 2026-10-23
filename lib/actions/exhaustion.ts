'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireDm, requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import { isUuid } from '@/lib/format';
import { writeLog } from '@/lib/inventory';
import type { Character } from '@/lib/types';

/** Menghapus penanda exhaustion (set ke 0) dan mencatatnya. Mengembalikan jumlah yang dihapus. */
async function clear(character: Character, by: 'player' | 'dm'): Promise<number> {
  // Bersyarat pada nilai yang dibaca: klik ganda tidak mencatat dua kali.
  const { data } = await db()
    .from('character')
    .update({ pending_exhaustion: 0 })
    .eq('id', character.id)
    .gt('pending_exhaustion', 0)
    .select('id');
  if ((data ?? []).length !== 1) return 0;
  await writeLog(character, 'exhaustion_clear', { count: character.pending_exhaustion, by });
  return character.pending_exhaustion;
}

/** Pemain menghapus penanda exhaustion setelah DM menetapkannya di sesi. */
export async function clearExhaustion() {
  const me = await requirePlayer();
  const n = await clear(me, 'player');
  revalidatePath('/play');
  go('/play', n ? 'ok' : 'error', n ? 'Exhaustion notice cleared.' : 'There was no exhaustion to clear.');
}

/** DM menghapus penanda exhaustion milik satu karakter. */
export async function clearExhaustionDm(formData: FormData) {
  const campaign = await requireDm();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) go('/dm/characters', 'error', 'Character not found.');
  const { data } = await db().from('character').select('*').eq('id', id).eq('campaign_id', campaign.id).maybeSingle();
  if (!data) go('/dm/characters', 'error', 'Character not found.');
  const n = await clear(data as Character, 'dm');
  revalidatePath(`/dm/characters/${id}`);
  revalidatePath('/dm/characters');
  revalidatePath('/play');
  go(`/dm/characters/${id}`, n ? 'ok' : 'error', n ? 'Exhaustion notice cleared.' : 'There was no exhaustion to clear.');
}
