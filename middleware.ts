// Every page and API call needs a signed-in user; only the login page, the sign-in routes, /api/health and assets
// are open. Every response also gets a Content Security Policy with a fresh nonce: the browser runs only the app's
// own scripts. Settings are read per request (not baked into the build), so one container image runs anywhere.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { COOKIE_OPTIONS } from '@/lib/cookies';
import { readSession, SESSION_COOKIE } from '@/lib/session';

const DEV = process.env.NODE_ENV === 'development';
const LOCAL = process.env.CIRCUIT_LOCAL_DB === '1' && DEV;

function policy(nonce: string) {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${DEV ? ` 'unsafe-eval'` : ''}`,   // dev: hot reload needs eval
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${DEV ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
  ].join('; ');
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname, open = path === '/login' || path.startsWith('/auth/') || path === '/api/health';
  const nonce = btoa(crypto.randomUUID()), csp = policy(nonce);
  const withCsp = <T extends NextResponse>(r: T) => { r.headers.set('Content-Security-Policy', csp); return r; };
  // Next.js reads the nonce from the request's policy and puts it on its own scripts
  const pass = () => {
    const h = new Headers(req.headers);
    h.set('x-nonce', nonce); h.set('Content-Security-Policy', csp);
    return withCsp(NextResponse.next({ request: { headers: h } }));
  };
  // behind a proxy (e.g. Azure) the server may see an internal address: redirects use the public one when known
  const base = process.env.SITE_URL || req.url;
  const deny = () => {
    if (path.startsWith('/api/')) return withCsp(NextResponse.json({ error: 'signed out' }, { status: 401 }));
    const to = new URL('/login', base);
    if (path !== '/') to.searchParams.set('next', path + req.nextUrl.search);
    return withCsp(NextResponse.redirect(to));
  };

  // /set-password needs the session from a sign-in link, so it is not open
  if (LOCAL) return req.cookies.get('circuit-local-user') || open ? pass() : deny();
  // postgres mode: our own session cookie (signature checked here, account and session checked by the database)
  if (process.env.CIRCUIT_BACKEND === 'postgres') {
    const s = await readSession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (!s && !open) return deny();
    if (s && path === '/login') return withCsp(NextResponse.redirect(new URL('/', base)));
    return pass();
  }
  const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (!URL_ || !KEY) return new NextResponse('Setup missing: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or CIRCUIT_BACKEND=postgres with its settings). See docs/HANDOVER.md.', { status: 500 });
  let res = pass();
  const sb = createServerClient(URL_, KEY, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = pass();
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        Object.entries(headers || {}).forEach(([k, v]) => res.headers.set(k, v));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user && !open) return deny();
  if (data.user && path === '/login') return withCsp(NextResponse.redirect(new URL('/', base)));
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|logo-dark.png|fonts/).*)'] };
