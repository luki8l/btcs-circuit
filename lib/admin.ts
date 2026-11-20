// Server only: Supabase with the secret key, for creating accounts and sign-in links. Never imported by client code.
import { createClient } from '@supabase/supabase-js';

export const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
export function supabaseAdmin() {
  if (!SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is missing (Vercel → Settings → Environment Variables).');
  return createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
