// Postgres mode: the app talks to any PostgreSQL directly (DATABASE_URL), exactly like Supabase's API does:
// per call a transaction with the user's claims set and the role "authenticated", then the same functions.
import { createRequire } from 'node:module';
import type { Pool as PgPool, PoolClient } from 'pg';
import { DbError, type Rpc } from './rpc';

const { Pool } = createRequire(import.meta.url)('pg') as typeof import('pg');
const g = globalThis as unknown as { __circuitPool?: PgPool };
export function pool(): PgPool {
  if (!process.env.DATABASE_URL) throw new DbError('DATABASE_URL is not set', 'config');
  return (g.__circuitPool ??= new Pool({
    connectionString: process.env.DATABASE_URL, max: Number(process.env.PGPOOL_MAX) || 5, idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000, application_name: 'circuit',
  }));
}

type Claims = { sub: string; iat: number } | null;
const asDbError = (e: unknown) => e instanceof DbError ? e : new DbError((e as Error)?.message || 'database error', (e as { code?: string })?.code || 'conn');

/** run fn inside a transaction as the signed-in user (or anon); throws 401 when the session is no longer valid */
export async function asUser<T>(claims: Claims, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect().catch(e => { throw asDbError(e); });
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify({ sub: claims.sub, iat: claims.iat, role: 'authenticated' }) : '']);
    await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    if (claims && !(await c.query<{ ok: boolean }>('select auth.session_ok() as ok')).rows[0].ok) throw new DbError('signed out', '28000');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw asDbError(e);
  } finally { c.release(); }
}

/** the database functions, called like Supabase's rpc() */
export function pgRpc(claims: Claims): Rpc {
  return async <T,>(fn: string, args: Record<string, unknown> = {}) => {
    if (!/^[a-z_]+$/.test(fn)) throw new DbError('bad function', '22023');
    const keys = Object.keys(args).filter(k => /^p_[a-z_]+$/.test(k));
    const vals = keys.map(k => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v; });
    return asUser(claims, async c => (await c.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, vals)).rows[0].r);
  };
}

/** server-only calls without a user (Microsoft sign-in lookup) */
export async function asService<T>(sql: string, params: unknown[]): Promise<T> {
  const c = await pool().connect().catch(e => { throw asDbError(e); });
  try {
    await c.query('begin'); await c.query('set local role service_role');
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows[0] as T;
  } catch (e) { await c.query('rollback').catch(() => {}); throw asDbError(e); }
  finally { c.release(); }
}
