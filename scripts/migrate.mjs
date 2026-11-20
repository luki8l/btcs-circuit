#!/usr/bin/env node
// Database changes, in order, each exactly once. Remembers what ran in public.circuit_migrations.
//
//   DATABASE_URL=postgres://… node scripts/migrate.mjs [options]
//
//   --backend postgres   plain PostgreSQL (Azure): also the Supabase stand-in (db/postgres/0*) before and the
//                        Microsoft sign-in functions (db/postgres/9*) after the migrations. Default: CIRCUIT_BACKEND,
//                        else "supabase" (only supabase/migrations).
//   --status             list what has run and what is pending; change nothing
//   --baseline           record every file as applied WITHOUT running it (a database that already has them)
//   --allow-changed      do not stop when an applied file has changed since (the migrations are safe to run again)
//
// Each file runs in its own transaction; an advisory lock stops two runs at once (pipeline + someone by hand).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const pg = createRequire(import.meta.url)('pg');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const backend = opt('--backend', process.env.CIRCUIT_BACKEND || 'supabase');
if (!['postgres', 'supabase'].includes(backend)) { console.error('--backend must be postgres or supabase'); process.exit(2); }
const url = opt('--database-url', process.env.DATABASE_URL);
if (!url) { console.error('Set DATABASE_URL (or --database-url).'); process.exit(2); }

const list = (dir, re) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => re.test(f)).sort().map(f => `${dir}/${f}`) : [];
const files = [
  ...(backend === 'postgres' ? list('db/postgres', /^0\d.*\.sql$/) : []),
  ...list('supabase/migrations', /\.sql$/),
  ...(backend === 'postgres' ? list('db/postgres', /^9\d.*\.sql$/) : []),
];
const sum = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');

const client = new pg.Client({ connectionString: url, application_name: 'circuit-migrate' });
await client.connect();
let code = 0;
try {
  await client.query(`select pg_advisory_lock(hashtext('circuit-migrate'))`);
  await client.query(`create table if not exists public.circuit_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
  await client.query(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then execute format('revoke all on public.circuit_migrations from %I', r); end if; end loop; end $$`);
  const done = new Map((await client.query('select name, checksum from public.circuit_migrations')).rows.map(r => [r.name, r.checksum]));
  console.log(`Circuit migrations · backend ${backend} · ${files.length} files`);
  for (const f of files) {
    const c = sum(f);
    if (done.has(f)) {
      if (done.get(f) !== c) {
        console.log(`  ! ${f} changed since it ran`);
        if (!flag('--allow-changed') && !flag('--status')) { code = 1; console.error('    Stop: check the change, then run again with --allow-changed (the migrations are safe to re-run) or restore the file.'); break; }
      } else if (flag('--status')) console.log(`  ✓ ${f}`);
      continue;
    }
    if (flag('--status')) { console.log(`  · ${f} (pending)`); continue; }
    if (flag('--baseline')) { await client.query('insert into public.circuit_migrations (name, checksum) values ($1, $2)', [f, c]); console.log(`  = ${f} (recorded, not run)`); continue; }
    process.stdout.write(`  → ${f} … `);
    try {
      await client.query('begin');
      await client.query(fs.readFileSync(path.join(root, f), 'utf8'));
      await client.query('insert into public.circuit_migrations (name, checksum) values ($1, $2)', [f, c]);
      await client.query('commit');
      console.log('done');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      console.log('FAILED');
      console.error(`    ${e.message}${e.position ? ` (at character ${e.position})` : ''}`);
      code = 1; break;
    }
  }
  if (!code) console.log(flag('--status') ? 'Status only, nothing changed.' : 'Database is up to date.');
} finally {
  await client.query(`select pg_advisory_unlock(hashtext('circuit-migrate'))`).catch(() => {});
  await client.end();
}
process.exit(code);
