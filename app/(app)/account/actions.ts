'use server';
// Change your own password: the current one is checked first, so a laptop left open is not enough.
import { supabaseServer } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { loginWait, loginNote, waitText } from '@/lib/throttle';
import { isPostgres } from '@/lib/backend';
import { readSession, signSession, sessionDays, cookieBase, SESSION_COOKIE } from '@/lib/session';

export type PwState = { ok?: boolean; err?: string } | null;
const LOCAL = process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1';

export async function changePassword(_prev: PwState, form: FormData): Promise<PwState> {
  const cur = String(form.get('current') || ''), a = String(form.get('password') || ''), b = String(form.get('again') || '');
  if (!cur) return { err: 'Enter your current password.' };
  if (a.length < 8) return { err: 'The new password needs at least 8 characters.' };
  if (a !== b) return { err: 'The two new passwords are not the same.' };
  if (a === cur) return { err: 'The new password is the same as the current one.' };
  if (isPostgres()) return { err: 'Passwords are not used: you sign in with Microsoft.' };
  if (LOCAL) return cur === 'demo' ? { ok: true } : { err: 'Your current password is not right.' };   // local development: password is always "demo"
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return { err: 'You are signed out. Please sign in again.' };
  const wait = await loginWait(user.email);
  if (wait) return { err: waitText(wait) };
  const check = await sb.auth.signInWithPassword({ email: user.email, password: cur });
  await loginNote(user.email, !check.error);
  if (check.error) return { err: 'Your current password is not right.' };
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) return { err: error.message };
  await sb.auth.signOut({ scope: 'others' });   // new password: other devices sign in again, this one stays
  return { ok: true };
}

/** sign out every other browser and device (a lost phone, a shared computer); this one stays signed in */
export async function signOutOthers(): Promise<PwState> {
  if (LOCAL) return { ok: true };
  if (isPostgres()) {
    // every session that started before now ends; this device gets a fresh one
    const jar = await cookies(), s = await readSession(jar.get(SESSION_COOKIE)?.value);
    if (!s) return { err: 'You are signed out. Please sign in again.' };
    try {
      const { asUser } = await import('@/lib/pgdb');
      const iat = await asUser(s, async c => Number((await c.query<{ t: string }>('select auth.sessions_reset() as t')).rows[0].t));
      jar.set(SESSION_COOKIE, await signSession(s.sub, iat), { ...cookieBase, maxAge: sessionDays() * 86400 });
      return { ok: true };
    } catch { return { err: 'That did not work. Try again.' }; }
  }
  const { error } = await (await supabaseServer()).auth.signOut({ scope: 'others' });
  return error ? { err: 'That did not work. Try again.' } : { ok: true };
}
