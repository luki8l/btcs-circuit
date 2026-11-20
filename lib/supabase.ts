import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { COOKIE_OPTIONS } from './cookies';

// server-side names first (read at runtime, so a container image works anywhere); the NEXT_PUBLIC_ names still work
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';


/** A Supabase client acting as the signed-in user (row level security applies). One per request. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a page: the middleware refreshes the session */ } },
    },
  });
}

/** true if this session started from a sign-in link (new account or password reset) in the last hour:
 *  only then may a password be set without typing the current one */
export async function fromFreshLink(): Promise<boolean> {
  const { data } = await (await supabaseServer()).auth.getClaims();
  const amr = data?.claims?.amr, now = Date.now() / 1000;
  return Array.isArray(amr) && amr.some(a => typeof a === 'object' && a.method !== 'password' && now - a.timestamp < 3600);
}
