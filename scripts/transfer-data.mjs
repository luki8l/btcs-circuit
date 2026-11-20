#!/usr/bin/env node
// Moves all Circuit data from one database to another, e.g. from Supabase to Azure Database for PostgreSQL.
//
//   SOURCE_DATABASE_URL=postgres://…supabase… DATABASE_URL=postgres://…azure… node scripts/transfer-data.mjs [--replace] [--dry-run]
//
// The target must already have the schema (node scripts/migrate.mjs --backend postgres). Copies accounts (auth.users:
// id, e-mail, names, role, last sign-in), profiles, events, requests, flags, suggestions and the activity log, with
// the same ids. Not copied: passwords (Microsoft sign-in has none), sign-in attempts, the migration list.
// The target's starting data (the masterlist events) is replaced. --replace is needed if the target already has
// requests or accounts (it is wiped first). Runs in one transaction: all or nothing.
import { createRequire } from 'node:module';
const pg = createRequire(import.meta.url)('pg');
const args = process.argv.slice(2), has = f => args.includes(f);
const SRC = process.env.SOURCE_DATABASE_URL, DST = process.env.DATABASE_URL;
if (!SRC || !DST) { console.error('Set SOURCE_DATABASE_URL (from) and DATABASE_URL (to).'); process.exit(2); }

const TABLES = [   // order matters: what others refer to comes first
  ['auth', 'users'], ['public', 'profiles'], ['public', 'events'], ['public', 'suggestions'], ['public', 'requests'], ['public', 'flags'], ['public', 'activity'],
];
const AUTH_COLS = ['id', 'email', 'raw_user_meta_data', 'raw_app_meta_data', 'last_sign_in_at', 'created_at'];
const q = (c, sql, p) => c.query(sql, p).then(r => r.rows);
const cols = async (c, s, t) => q(c, `select column_name, data_type, is_identity from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position`, [s, t]);

const src = new pg.Client({ connectionString: SRC, application_name: 'circuit-transfer' }), dst = new pg.Client({ connectionString: DST, application_name: 'circuit-transfer' });
await src.connect(); await dst.connect();
try {
  const ready = await q(dst, `select to_regclass('public.circuit_migrations') is not null as m, to_regproc('auth.entra_sign_in') is not null as e`);
  if (!ready[0].m || !ready[0].e) throw new Error('The target has no Circuit schema yet: run  node scripts/migrate.mjs --backend postgres  against it first.');
  const used = await q(dst, `select (select count(*) from public.requests)::int as r, (select count(*) from auth.users)::int as u`);
  if ((used[0].r || used[0].u) && !has('--replace')) throw new Error(`The target already has ${used[0].u} accounts and ${used[0].r} requests. Run again with --replace to wipe them first.`);

  const counts = [];
  await dst.query('begin');
  await dst.query('truncate public.activity, public.flags, public.requests, public.suggestions, public.events, public.login_attempts restart identity cascade');
  await dst.query('delete from public.profiles'); await dst.query('delete from auth.users');
  for (const [s, t] of TABLES) {
    const sc = new Map((await cols(src, s, t)).map(c => [c.column_name, c]));
    const dc = (await cols(dst, s, t)).filter(c => sc.has(c.column_name) && (s !== 'auth' || AUTH_COLS.includes(c.column_name)));
    const names = dc.map(c => c.column_name), json = new Set(dc.filter(c => /json/.test(c.data_type)).map(c => c.column_name));
    const rows = await q(src, `select ${names.map(n => `"${n}"`).join(', ')} from ${s}.${t}`);
    for (const r of rows) {
      const vals = names.map(n => (json.has(n) && r[n] !== null ? JSON.stringify(r[n]) : r[n]));
      const ph = names.map((_, i) => `$${i + 1}`).join(', ');
      // accounts create a profile by trigger: the copied profile then replaces it
      const tail = t === 'profiles' ? ` on conflict (id) do update set ${names.filter(n => n !== 'id').map(n => `"${n}" = excluded."${n}"`).join(', ')}` : '';
      await dst.query(`insert into ${s}.${t} (${names.map(n => `"${n}"`).join(', ')}) overriding system value values (${ph})${tail}`, vals);
    }
    // identity counters continue after the copied ids
    for (const c of dc.filter(c => c.is_identity === 'YES')) await dst.query(`select setval(pg_get_serial_sequence('${s}.${t}', '${c.column_name}'), greatest((select max("${c.column_name}") from ${s}.${t}), 1))`);
    const n = (await q(dst, `select count(*)::int as n from ${s}.${t}`))[0].n;
    counts.push({ table: `${s}.${t}`, source: rows.length, target: n, columns: names.length, skipped: [...sc.keys()].filter(k => !names.includes(k)).join(' ') || '' });
  }
  if (has('--dry-run')) { await dst.query('rollback'); console.log('Dry run: nothing written.'); } else await dst.query('commit');
  console.table(counts.map(({ skipped, ...c }) => c));
  const odd = await q(has('--dry-run') ? src : dst, `select email from ${has('--dry-run') ? 'auth' : 'auth'}.users order by email`);
  const domains = new Map(); odd.forEach(r => { const d = (r.email || '').split('@')[1] || '?'; domains.set(d, (domains.get(d) || 0) + 1); });
  console.log('Accounts by e-mail domain:', Object.fromEntries(domains), '\nEach e-mail must match the person\'s Microsoft login. Change one with: node scripts/add-user.mjs --rename old new');
} catch (e) {
  await dst.query('rollback').catch(() => {});
  console.error('Stopped, nothing written:', e.message); process.exitCode = 1;
} finally { await src.end(); await dst.end(); }
