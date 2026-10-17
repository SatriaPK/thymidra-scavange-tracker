'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { clearSession, createSession, fingerprint } from '@/lib/session';
import { go } from '@/lib/flash';
import type { Campaign, Character } from '@/lib/types';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

export async function playerLogin(formData: FormData) {
  const name = text(formData, 'name');
  const code = text(formData, 'code').toUpperCase();
  if (!name || !code) go('/', 'error', 'Isi nama karakter dan kode.');

  const { data } = await db()
    .from('character')
    .select('*')
    .ilike('name', escapeLike(name))
    .eq('access_code', code)
    .limit(2);
  const rows = (data ?? []) as Character[];
  // Pesan sama untuk nama salah / kode salah supaya tidak membocorkan nama yang ada.
  if (rows.length !== 1) go('/', 'error', 'Nama karakter atau kode salah.');

  const c = rows[0];
  await createSession({
    role: 'player',
    campaignId: c.campaign_id,
    characterId: c.id,
    fp: fingerprint(c.access_code),
  });
  redirect(c.setup_done ? '/play' : '/play/setup');
}

export async function dmLogin(formData: FormData) {
  const code = text(formData, 'code');
  if (!code) go('/dm/login', 'error', 'Isi kode DM.');

  const { data } = await db().from('campaign').select('*').eq('dm_code', code).maybeSingle();
  const campaign = data as Campaign | null;
  if (!campaign) go('/dm/login', 'error', 'Kode DM salah.');

  await createSession({ role: 'dm', campaignId: campaign.id, fp: fingerprint(campaign.dm_code) });
  redirect('/dm');
}

export async function logout() {
  await clearSession();
  redirect('/');
}
