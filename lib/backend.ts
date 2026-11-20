// Which database and sign-in this instance uses. Read at runtime, so the same build runs either way.
//   supabase (default): Supabase (database + e-mail/password sign-in), today's production on Vercel
//   postgres:           any PostgreSQL (e.g. Azure Database for PostgreSQL) + sign-in with Microsoft (Entra ID)
// Local development with the in-process database (CIRCUIT_LOCAL_DB=1) overrides both.
export type Backend = 'supabase' | 'postgres';
export const backend = (): Backend => (process.env.CIRCUIT_BACKEND === 'postgres' ? 'postgres' : 'supabase');
export const isPostgres = () => backend() === 'postgres' && !(process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1');

/** public address of the app (sign-in redirects, links); server-side env, not baked into the build */
export const siteUrl = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
