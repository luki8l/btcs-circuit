// Sign-in links from an admin (new account or new password): verify the one-time token, then set a password.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { LOCAL } from '@/lib/rpc';

export async function GET(req: Request) {
  const u = new URL(req.url), token_hash = u.searchParams.get('token_hash') || '', type = u.searchParams.get('type');
  if (LOCAL) {
    const uid = u.searchParams.get('local') || '';
    if (/^[0-9a-f-]{36}$/.test(uid)) { (await cookies()).set('circuit-local-user', uid, { httpOnly: true, sameSite: 'lax', path: '/' }); return NextResponse.redirect(new URL('/set-password', req.url)); }
    return NextResponse.redirect(new URL('/login?link=bad', req.url));
  }
  if (token_hash && (type === 'recovery' || type === 'invite' || type === 'magiclink')) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL('/set-password', req.url));
  }
  return NextResponse.redirect(new URL('/login?link=expired', req.url));
}
