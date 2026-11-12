// Every page and API call needs a signed-in user; only the login page, the sign-in link handler and assets are open.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || '', KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const LOCAL = process.env.CIRCUIT_LOCAL_DB === '1' && process.env.NODE_ENV === 'development';

function deny(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const to = new URL('/login', req.url);
  if (req.nextUrl.pathname !== '/') to.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(to);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname, open = path === '/login' || path.startsWith('/auth/');
  // /set-password needs the session from a sign-in link, so it is not open
  if (LOCAL) return req.cookies.get('circuit-local-user') || open ? NextResponse.next() : deny(req);
  if (!URL_ || !KEY) return new NextResponse('Setup missing: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel (Settings → Environment Variables), then redeploy.', { status: 500 });
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        Object.entries(headers || {}).forEach(([k, v]) => res.headers.set(k, v));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user && !open) return deny(req);
  if (data.user && path === '/login') return NextResponse.redirect(new URL('/', req.url));
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|fonts/).*)'] };
