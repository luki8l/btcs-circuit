'use server';
// Change your own password: the current one is checked first, so a laptop left open is not enough.
import { supabaseServer } from '@/lib/supabase';
import { loginWait, loginNote, waitText } from '@/lib/throttle';

export type PwState = { ok?: boolean; err?: string } | null;
const LOCAL = process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1';

export async function changePassword(_prev: PwState, form: FormData): Promise<PwState> {
  const cur = String(form.get('current') || ''), a = String(form.get('password') || ''), b = String(form.get('again') || '');
  if (!cur) return { err: 'Enter your current password.' };
  if (a.length < 8) return { err: 'The new password needs at least 8 characters.' };
  if (a !== b) return { err: 'The two new passwords are not the same.' };
  if (a === cur) return { err: 'The new password is the same as the current one.' };
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
  const { error } = await (await supabaseServer()).auth.signOut({ scope: 'others' });
  return error ? { err: 'That did not work. Try again.' } : { ok: true };
}
