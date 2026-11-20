#!/usr/bin/env node
// postgres mode, run by IT with the database admin connection (DATABASE_URL):
//   add an account (e.g. the first admin):  node scripts/add-user.mjs --email anna.muster@bitcoinsuisse.com --name "Anna Muster" --role admin
//   change someone's e-mail (to match their Microsoft login):  node scripts/add-user.mjs --rename old@x.com new@bitcoinsuisse.com
//   list accounts:  node scripts/add-user.mjs --list
// Roles: admin, events (Roman: approves), management (read-only), sales. Everything else is done in the app (People).
import { createRequire } from 'node:module';
const pg = createRequire(import.meta.url)('pg');
const a = process.argv.slice(2), opt = f => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL (database admin).'); process.exit(2); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'circuit-add-user' });
await c.connect();
try {
  if (a.includes('--list')) {
    const r = await c.query(`select p.email, p.name, p.role, p.team, p.active, u.last_sign_in_at from public.profiles p join auth.users u on u.id = p.id order by p.active desc, p.name`);
    console.table(r.rows);
  } else if (a.includes('--rename')) {
    const i = a.indexOf('--rename'), from = (a[i + 1] || '').toLowerCase(), to = (a[i + 2] || '').toLowerCase();
    if (!from || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('usage: --rename old@x.com new@bitcoinsuisse.com');
    await c.query('begin');
    const u = await c.query(`update auth.users set email = $2, raw_user_meta_data = raw_user_meta_data - 'entra_oid' where lower(email) = $1 returning id`, [from, to]);
    if (!u.rowCount) throw new Error(`no account with ${from}`);
    await c.query(`update public.profiles set email = $2 where id = $1`, [u.rows[0].id, to]);
    await c.query('commit');
    console.log(`${from} → ${to}. They sign in with Microsoft as ${to}.`);
  } else {
    const email = (opt('--email') || '').trim().toLowerCase(), name = (opt('--name') || '').trim(), role = opt('--role') || 'sales';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2) throw new Error('usage: --email name@bitcoinsuisse.com --name "First Last" [--role admin|events|management|sales] [--team T] [--market M] [--title T]');
    if (!['admin', 'events', 'management', 'sales'].includes(role)) throw new Error('role: admin, events, management or sales');
    const meta = { name, team: opt('--team') || '', market: opt('--market') || '', title: opt('--title') || '' };
    const r = await c.query(`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) on conflict (email) do nothing returning id`, [email, meta, { role }]);
    if (!r.rowCount) throw new Error(`${email} has an account already`);
    console.log(`Account for ${name} <${email}> (${role}). They sign in with Microsoft.`);
  }
} catch (e) { await c.query('rollback').catch(() => {}); console.error(e.message); process.exitCode = 1; }
finally { await c.end(); }
