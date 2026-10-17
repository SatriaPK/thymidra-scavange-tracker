import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { db } from './db';
import type { Campaign, Character } from './types';

const COOKIE = 'scv_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 hari

type SessionPayload =
  | { role: 'dm'; campaignId: string; fp: string }
  | { role: 'player'; campaignId: string; characterId: string; fp: string };

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET harus diisi di .env.local (minimal 32 karakter acak)');
  }
  return new TextEncoder().encode(s);
}

/**
 * Sidik jari kode akses. Disimpan di cookie sehingga bila DM mengganti kode,
 * sesi lama otomatis tidak berlaku lagi.
 */
export function fingerprint(code: string): string {
  return createHash('sha256')
    .update(process.env.SESSION_SECRET ?? '')
    .update(code)
    .digest('hex')
    .slice(0, 16);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Dipanggil di awal setiap halaman DM dan setiap aksi DM. */
export async function requireDm(): Promise<Campaign> {
  const s = await readSession();
  if (!s || s.role !== 'dm') redirect('/dm/login');
  const { data } = await db().from('campaign').select('*').eq('id', s.campaignId).maybeSingle();
  const campaign = data as Campaign | null;
  if (!campaign || fingerprint(campaign.dm_code) !== s.fp) redirect('/dm/login');
  return campaign;
}

/** Dipanggil di awal setiap halaman pemain dan setiap aksi pemain. */
export async function requirePlayer(): Promise<Character> {
  const s = await readSession();
  if (!s || s.role !== 'player') redirect('/');
  const { data } = await db()
    .from('character')
    .select('*')
    .eq('id', s.characterId)
    .eq('campaign_id', s.campaignId)
    .maybeSingle();
  const character = data as Character | null;
  if (!character || fingerprint(character.access_code) !== s.fp) redirect('/');
  return character;
}
