// The one way the app talks to the database: the functions in supabase/migrations, called as the signed-in user.
// supabase mode: Supabase (PostgREST). postgres mode: any PostgreSQL directly (lib/pgdb.ts).
// Local development (CIRCUIT_LOCAL_DB=1): the same SQL in an in-process Postgres (PGlite).
import { cookies } from 'next/headers';
import { supabaseServer } from './supabase';
import { isPostgres } from './backend';
import { readSession, SESSION_COOKIE } from './session';

export const LOCAL = process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1';

export class DbError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

export async function rpcClient(): Promise<Rpc> {
  if (process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1') return (await import('./localdb')).localRpc();
  if (isPostgres()) {
    const claims = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
    return (await import('./pgdb')).pgRpc(claims);
  }
  const sb = await supabaseServer();
  return async <T,>(fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new DbError(error.message, error.code || 'unknown');
    return data as T;
  };
}

/** HTTP status for a database error: the SQLSTATE codes raised in the migration */
export function statusOf(e: unknown): number {
  const code = e instanceof DbError ? e.code : '';
  if (code === '28000' || code === 'PGRST301') return 401;
  if (code === '42501') return 403;
  if (code === 'P0002') return 404;
  if (code === '23505') return 409;
  if (['22023', '22P02', '22007', '22008', '23514', '23502', '22001', '22003'].includes(code)) return 400;
  return 500;
}

/** a readable message for the user */
export function messageOf(e: unknown): string {
  const code = e instanceof DbError ? e.code : '';
  const m = (e as Error)?.message || '';
  if (code === '23514') return 'Some input is not valid (check dates and fields).';
  if (code === '22P02' || code === '22007' || code === '22008') return 'Some input has the wrong format.';
  if (statusOf(e) === 500) return 'Something went wrong on the server. Try again.';
  return m.charAt(0).toUpperCase() + m.slice(1);
}
