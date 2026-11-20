// postgres mode: start "Sign in with Microsoft". Remembers PKCE verifier, state, nonce and the target page in a
// short-lived signed cookie, then sends the browser to Microsoft.
import { NextResponse } from 'next/server';
import { isPostgres, siteUrl } from '@/lib/backend';
import { startSignIn } from '@/lib/entra';
import { signFlow, cookieBase, OIDC_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';
const safeNext = (n: string | null) => (n && /^\/(?![/\\])[^\\]*$/.test(n) ? n : '/');

export async function GET(req: Request) {
  const base = siteUrl() || new URL(req.url).origin;
  if (!isPostgres()) return NextResponse.redirect(new URL('/login', base));
  try {
    const { url, verifier, state, nonce } = await startSignIn();
    const res = NextResponse.redirect(url.href);
    res.cookies.set(OIDC_COOKIE, await signFlow({ verifier, state, nonce, next: safeNext(new URL(req.url).searchParams.get('next')) }), { ...cookieBase, maxAge: 600 });
    return res;
  } catch (e) {
    console.error('microsoft sign-in start', e);
    return NextResponse.redirect(new URL('/login?error=config', base));
  }
}
