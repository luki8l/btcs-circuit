/** The session cookies: only the server reads them (the browser never talks to Supabase), HTTPS only, not sent
 *  along from other sites. They last 400 days (the browser maximum, @supabase/ssr default), so people stay signed in. */
export const COOKIE_OPTIONS = { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
