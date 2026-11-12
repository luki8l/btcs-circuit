// Local development only: Postgres in the process (PGlite), with the real migrations and a stand-in for Supabase Auth.
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { PGlite } from '@electric-sql/pglite';
import { DbError, type Rpc } from './rpc';

export const LOCAL_COOKIE = 'circuit-local-user';
const g = globalThis as unknown as { __circuitPg?: Promise<PGlite> };
const root = process.cwd();

async function open(): Promise<PGlite> {
  const db = new PGlite(process.env.CIRCUIT_LOCAL_DB_DIR || undefined);
  await db.exec(fs.readFileSync(path.join(root, 'supabase/dev/auth-stub.sql'), 'utf8'));
  const dir = path.join(root, 'supabase/migrations');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (process.env.CIRCUIT_LOCAL_DEMO === '1') await db.exec(fs.readFileSync(path.join(root, 'supabase/dev/demo.sql'), 'utf8'));
  return db;
}
export const localDb = () => (g.__circuitPg ??= open());

/** roles in local mode: CIRCUIT_LOCAL_ADMINS=a@x.com and CIRCUIT_LOCAL_ROLES=roman@x.com:events,ceo@x.com:management */
function localRole(email: string): string | null {
  if ((process.env.CIRCUIT_LOCAL_ADMINS || '').toLowerCase().split(',').map(s => s.trim()).includes(email)) return 'admin';
  for (const pair of (process.env.CIRCUIT_LOCAL_ROLES || '').toLowerCase().split(',')) {
    const [e, r] = pair.split(':').map(s => (s || '').trim());
    if (e === email && ['admin', 'events', 'management', 'sales'].includes(r)) return r;
  }
  return null;
}

/** "sign in": any e-mail */
export async function localSignIn(email: string): Promise<string> {
  const db = await localDb(), e = email.toLowerCase(), role = localRole(e);
  await db.query(`insert into auth.users (email, raw_app_meta_data) values ($1, $2) on conflict (email) do nothing`, [e, JSON.stringify(role ? { role } : {})]);
  const id = (await db.query<{ id: string }>(`select id from auth.users where email = $1`, [e])).rows[0].id;
  if (role) await db.query(`update public.profiles set role = $2 where id = $1`, [id, role]);
  await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [id]);
  return id;
}

/** an account created by an admin (local stand-in for the Supabase admin API) */
export async function localCreateUser(email: string, meta: Record<string, string>, role: string): Promise<string> {
  const db = await localDb();
  await db.query(`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3)`, [email.toLowerCase(), JSON.stringify(meta), JSON.stringify({ role })]);
  return (await db.query<{ id: string }>(`select id from auth.users where email = $1`, [email.toLowerCase()])).rows[0].id;
}

export async function localRpc(): Promise<Rpc> {
  const db = await localDb(), uid = (await cookies()).get(LOCAL_COOKIE)?.value || '';
  return async <T,>(fn: string, args: Record<string, unknown> = {}) => {
    if (!/^[a-z_]+$/.test(fn)) throw new DbError('bad function', '22023');
    const keys = Object.keys(args).filter(k => /^p_[a-z_]+$/.test(k));
    try {
      return await db.transaction(async tx => {
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
        await tx.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
        const vals = keys.map(k => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v; });
        const r = await tx.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, vals);
        return r.rows[0].r;
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      throw new DbError(err.message || String(e), err.code === '42883' ? '22023' : err.code || 'unknown');
    }
  };
}
