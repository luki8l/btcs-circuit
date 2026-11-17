// Every page and API call needs a signed-in user; only the login page, the sign-in link handler and assets are open.
// Every response also gets a Content Security Policy with a fresh nonce: the browser runs only the app's own scripts.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { COOKIE_OPTIONS } from '@/lib/cookies';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || '', KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
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
  const path = req.nextUrl.pathname, open = path === '/login' || path.startsWith('/auth/');
  const nonce = btoa(crypto.randomUUID()), csp = policy(nonce);
  const withCsp = <T extends NextResponse>(r: T) => { r.headers.set('Content-Security-Policy', csp); return r; };
  // Next.js reads the nonce from the request's policy and puts it on its own scripts
  const pass = () => {
    const h = new Headers(req.headers);
    h.set('x-nonce', nonce); h.set('Content-Security-Policy', csp);
    return withCsp(NextResponse.next({ request: { headers: h } }));
  };
  const deny = () => {
    if (path.startsWith('/api/')) return withCsp(NextResponse.json({ error: 'signed out' }, { status: 401 }));
    const to = new URL('/login', req.url);
    if (path !== '/') to.searchParams.set('next', path + req.nextUrl.search);
    return withCsp(NextResponse.redirect(to));
  };

  // /set-password needs the session from a sign-in link, so it is not open
  if (LOCAL) return req.cookies.get('circuit-local-user') || open ? pass() : deny();
  if (!URL_ || !KEY) return new NextResponse('Setup missing: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel (Settings → Environment Variables), then redeploy.', { status: 500 });
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
  if (data.user && path === '/login') return withCsp(NextResponse.redirect(new URL('/', req.url)));
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|logo-dark.png|fonts/).*)'] };
