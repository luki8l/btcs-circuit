// postgres mode: Microsoft sends the browser back here. Check the answer, find the Circuit account (by Microsoft
// object id, else e-mail), start a session. No Circuit account = no access (accounts are created by an admin).
import { NextResponse } from 'next/server';
import { isPostgres, siteUrl } from '@/lib/backend';
import { finishSignIn } from '@/lib/entra';
import { asService } from '@/lib/pgdb';
import { readFlow, signSession, sessionDays, cookieBase, OIDC_COOKIE, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const base = siteUrl() || new URL(req.url).origin, inUrl = new URL(req.url);
  const back = (q: string) => { const r = NextResponse.redirect(new URL(`/login?${q}`, base)); r.cookies.set(OIDC_COOKIE, '', { ...cookieBase, maxAge: 0 }); return r; };
  if (!isPostgres()) return back('');
  if (inUrl.searchParams.get('error')) return back('error=cancelled');           // e.g. the user cancelled at Microsoft
  const flow = await readFlow(req.headers.get('cookie')?.match(new RegExp(`(?:^|; )${OIDC_COOKIE}=([^;]+)`))?.[1]);
  if (!flow) return back('error=expired');
  try {
    // the address Microsoft redirected to, as the browser saw it (the app may sit behind a proxy)
    const cb = new URL(`${base}/auth/callback${inUrl.search}`);
    const who = await finishSignIn(cb, { verifier: flow.verifier, state: flow.state, nonce: flow.nonce });
    const r = await asService<{ r: { status: string; id?: string; iat?: number } }>('select auth.entra_sign_in($1, $2) as r', [who.email, who.oid]);
    if (r.r.status !== 'ok') return back(`error=${r.r.status === 'inactive' ? 'inactive' : 'no_account'}&email=${encodeURIComponent(who.email)}`);
    const res = NextResponse.redirect(new URL(flow.next || '/', base));
    res.cookies.set(SESSION_COOKIE, await signSession(r.r.id!, r.r.iat!), { ...cookieBase, maxAge: sessionDays() * 86400 });
    res.cookies.set(OIDC_COOKIE, '', { ...cookieBase, maxAge: 0 });
    return res;
  } catch (e) {
    console.error('microsoft sign-in', e);
    return back(/organisation/.test(String((e as Error)?.message)) ? 'error=org' : 'error=failed');
  }
}
