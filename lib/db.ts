import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hanya dipakai di server. Kunci rahasia JANGAN pernah memakai awalan NEXT_PUBLIC_.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY harus diisi di .env.local');
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
