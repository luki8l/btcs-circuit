'use server';
// Change your own password: the current one is checked first, so a laptop left open is not enough.
import { supabaseServer } from '@/lib/supabase';

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
  const check = await sb.auth.signInWithPassword({ email: user.email, password: cur });
  if (check.error) return { err: 'Your current password is not right.' };
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) return { err: error.message };
  return { ok: true };
}
