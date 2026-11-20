'use server';
import { cookies } from 'next/headers';
import { supabaseServer, fromFreshLink } from '@/lib/supabase';
import { loginWait, loginNote, waitText } from '@/lib/throttle';
import { isPostgres } from '@/lib/backend';

/** e-mail as stored: lower case, no accents (ø → o, æ → ae, å → a, é → e, ü → u) */
const plain = (e: string) => e.toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export type SignInState = { ok?: boolean; err?: string; email?: string } | null;

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  if (isPostgres()) return { err: 'Please use “Sign in with Microsoft”.' };
  const email = String(form.get('email') || '').trim(), password = String(form.get('password') || '');
  if (!email || !password) return { err: 'Please enter your e-mail and password.', email };
  const login = plain(email);
  if (process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1') {   // local development only
    if (password !== 'demo') return { err: 'E-mail or password is not right.', email };
    const { localSignIn, LOCAL_COOKIE } = await import('@/lib/localdb');
    (await cookies()).set(LOCAL_COOKIE, await localSignIn(email), { httpOnly: true, sameSite: 'lax', path: '/' });
    return { ok: true, email };
  }
  const wait = await loginWait(login);
  if (wait) return { err: waitText(wait), email };
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: login, password });
  await loginNote(login, !error);
  if (error) return { err: 'E-mail or password is not right.', email };
  return { ok: true, email };
}

export async function setPassword(_prev: SignInState, form: FormData): Promise<SignInState> {
  if (isPostgres()) return { err: 'Passwords are not used: sign in with Microsoft.' };
  const a = String(form.get('password') || ''), b = String(form.get('again') || '');
  if (a.length < 8) return { err: 'At least 8 characters, please.' };
  if (a !== b) return { err: 'The two passwords are not the same.' };
  if (process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1') return { ok: true };
  // only right after a sign-in link; a signed-in browser alone can't set a new password (that needs the current one, under Account)
  if (!(await fromFreshLink())) return { err: 'This link has expired. Ask for a new one, or change your password under Account.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) return { err: error.message.includes('session') ? 'Your link has expired. Ask for a new one.' : error.message };
  await sb.auth.signOut({ scope: 'others' });   // new password: other devices sign in again
  return { ok: true };
}
