// Sign out on this device. POST (the menu). GET only ends a session the database already rejected (e.g. after
// "sign out on all other devices" or deactivation), so a link from another site cannot sign anyone out.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { LOCAL } from '@/lib/rpc';
import { isPostgres, siteUrl } from '@/lib/backend';
import { readSession, cookieBase, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  if (LOCAL) (await cookies()).delete('circuit-local-user');
  else if (isPostgres()) (await cookies()).set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 });
  else await (await supabaseServer()).auth.signOut();
  const base = siteUrl() || req.url;
  if ((req.headers.get('content-type') || '').includes('form')) return NextResponse.redirect(new URL(isPostgres() ? '/login?signedout=1' : '/login', base), 303);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const base = siteUrl() || req.url;
  if (!isPostgres()) return NextResponse.redirect(new URL('/login', base));
  const jar = await cookies(), s = await readSession(jar.get(SESSION_COOKIE)?.value);
  let valid = false;
  if (s) { try { const { asUser } = await import('@/lib/pgdb'); valid = await asUser(s, async () => true); } catch { valid = false; } }
  if (valid) return NextResponse.redirect(new URL('/', base));
  const res = NextResponse.redirect(new URL('/login?expired=1', base));
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 });
  return res;
}
