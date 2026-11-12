// The migrations against real Postgres (PGlite, in process): node tests/sql.test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const MIG = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort().map(f => read('supabase/migrations/' + f));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };

const db = new PGlite();
await db.exec(read('supabase/dev/auth-stub.sql'));
for (const m of MIG) await db.exec(m);
for (const m of MIG) await db.exec(m);                    // twice: safe to run again
console.log('migrations ran twice');

const ADM = '00000000-0000-0000-0000-00000000000a', ROM = '00000000-0000-0000-0000-00000000000b', CEO = '00000000-0000-0000-0000-00000000000c',
      ANA = '00000000-0000-0000-0000-00000000000d', BEN = '00000000-0000-0000-0000-00000000000e';
await db.exec(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('${ADM}', 'lukas@example.com', '{"name":"Lukas Example"}', '{"role":"admin"}'),
  ('${ROM}', 'roman@example.com', '{"name":"Roman Example"}', '{"role":"events"}'),
  ('${CEO}', 'ceo@example.com', '{"name":"Chief Example"}', '{"role":"management"}'),
  ('${ANA}', 'ana.muster@example.com', '{"market":"Sweden","role":"admin"}', '{}'),
  ('${BEN}', 'ben@example.com', '{"name":"Ben Beispiel"}', '{}')`);

async function as(uid, sql, params = []) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    await tx.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    return (await tx.query(sql, params)).rows;
  });
}
const call = async (uid, fn, args = {}) => { const k = Object.keys(args); const r = await as(uid, `select public.${fn}(${k.map((x, i) => `${x} => $${i + 1}`).join(', ')}) as r`, k.map(x => args[x] !== null && typeof args[x] === 'object' && !Array.isArray(args[x]) ? JSON.stringify(args[x]) : args[x])); return r[0].r; };
const err = async p => { try { await p; return null; } catch (e) { return e.code || e.message; } };

console.log('people');
const me = await call(ANA, 'me');
ok(me.name === 'Ana Muster' && me.initials === 'AM' && me.role === 'sales' && me.market === 'Sweden', 'profile from sign-up: name from e-mail, initials, market; a role in user metadata is ignored');
ok((await call(ADM, 'me')).role === 'admin' && (await call(ROM, 'me')).role === 'events', 'roles from app metadata (set by the server)');

console.log('access');
ok(await err(call(null, 'bootstrap')) === '42501', 'anonymous: functions not callable');
ok(await err(as(null, 'select * from public.events')) === '42501', 'anonymous: no table access');
ok(await err(as(ANA, `insert into public.requests (event_id, person_id) values (1, '${ANA}')`)) === '42501', 'signed in: no direct writes');
ok(await err(as(ANA, `update public.events set tier = 1`)) === '42501', 'signed in: cannot edit events directly');
ok(await err(call(ANA, 'require_role')) === '42501', 'internal helpers not callable');
ok(await err(as(ANA, 'select * from public.activity')) === '42501', 'activity not readable directly');

console.log('catalogue');
const boot = await call(ANA, 'bootstrap');
ok(boot.events.length === 267, `masterlist seeded once (${boot.events.length} events)`);
const cfc = boot.events.find(e => e.name === 'CfC St. Moritz');
ok(cfc.tier === 1 && cfc.mode === 'month' && cfc.start === '2027-01-01' && cfc.fit.join() === '5,5,5,4,5' && cfc.ratingDist.join() === '0,2,4,1,7', 'CfC: tier 1, month only, fit and ratings');
ok(!JSON.stringify(boot.events).match(/[\w.+-]+@[\w-]+\.[\w.-]+/), 'no e-mail addresses in the catalogue');
ok(boot.suggestions.length === 0, 'sales do not see others’ suggestions');
ok((await call(ROM, 'bootstrap')).suggestions.length === 1, 'events team sees the masterlist suggestion');
const t4 = boot.events.find(e => e.tier === 4 && e.mode !== 'tbd');

console.log('requests');
let r = await call(ANA, 'request_create', { p_event: cfc.id, p_mode: 'attend', p_ticket: 'paid', p_cost: 4800, p_groups: [2, 1], p_meetings: 5, p_reason: 'UHNW prospects attend' });
ok(r.status === 'requested' && r.cost == 4800 && r.groups.join() === '1,2', 'request: waiting, cost kept, groups sorted');
ok(await err(call(ANA, 'request_create', { p_event: cfc.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [2], p_meetings: 0, p_reason: '' })) === '23505', 'no second active request for the same event');
ok(await err(call(BEN, 'request_create', { p_event: t4.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 0, p_reason: '' })) === '22023', 'tier 4 needs a reason');
ok(await err(call(BEN, 'request_create', { p_event: cfc.id, p_mode: 'party', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 0, p_reason: '' })) === '22023', 'unknown mode refused');
ok(await err(call(BEN, 'request_create', { p_event: cfc.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [], p_meetings: 0, p_reason: '' })) === '22023', 'needs a target group');
const rb = await call(BEN, 'request_create', { p_event: t4.id, p_mode: 'meetings', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 3, p_reason: 'Three meetings pre-booked' });
ok(await err(call(ANA, 'request_decide', { p_ids: [r.id], p_status: 'approved' })) === '42501', 'sales cannot approve');
ok(await err(call(CEO, 'request_decide', { p_ids: [r.id], p_status: 'approved' })) === '42501', 'management cannot approve');
ok(await err(call(BEN, 'request_withdraw', { p_id: r.id })) === 'P0002', 'cannot withdraw someone else’s request');
r = await call(ANA, 'request_edit', { p_id: r.id, p_mode: 'speak', p_ticket: 'free', p_cost: 999, p_groups: [2], p_meetings: 6, p_reason: 'Panel slot' });
ok(r.mode === 'speak' && r.cost == 0, 'owner edits a waiting request; free ticket means no cost');
ok(await call(ROM, 'request_decide', { p_ids: [r.id, rb.id], p_status: 'approved', p_note: 'Go' }) === 2, 'events team approves two at once');
ok(await err(call(ANA, 'request_edit', { p_id: r.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [2], p_meetings: 1, p_reason: '' })) === '22023', 'approved requests cannot be edited');
ok(await err(call(ANA, 'request_debrief', { p_id: r.id, p_leads: 3, p_held: 2, p_rating: 4, p_again: 'yes', p_note: '' })) === '22023', 'no debrief before the event');
r = await call(ANA, 'request_hubspot', { p_id: r.id, p_done: true });
ok(r.hubspot === true, 'owner ticks the HubSpot step');
const past = boot.events.find(e => e.mode === 'exact' && e.end && e.end < '2026-10-01');
let rp = await call(ROM, 'request_assign', { p_event: past.id, p_person: ANA, p_mode: 'attend', p_note: 'Covered by Ana' });
ok(rp.status === 'approved' && rp.personId === ANA, 'events team sends someone directly');
rp = await call(ANA, 'request_debrief', { p_id: rp.id, p_leads: 7, p_held: 5, p_rating: 4, p_again: 'yes', p_note: 'Good crowd' });
ok(rp.leads === 7 && rp.rating === 4 && rp.hubspot === true, 'debrief after the event: leads, rating, HubSpot done');
ok(await err(call(BEN, 'request_debrief', { p_id: rp.id, p_leads: 1, p_held: 1, p_rating: 1, p_again: 'no', p_note: '' })) === 'P0002', 'others cannot debrief your event');
r = await call(ROM, 'request_reopen', { p_id: rb.id });
ok(r.status === 'requested', 'events team takes a decision back');
ok(await call(ROM, 'request_decide', { p_ids: [rb.id], p_status: 'declined', p_note: 'Tier 4' }) === 1, 'and declines');
r = await call(BEN, 'request_create', { p_event: t4.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 0, p_reason: 'Asking again with meetings' });
ok(r.status === 'requested', 'after a decline you can ask again');

console.log('flags & suggestions');
ok(await err(call(ANA, 'flag_set', { p_event: cfc.id, p_on: true })) === '42501', 'sales cannot flag');
ok(await call(ROM, 'flag_set', { p_event: cfc.id, p_on: true, p_note: 'need a speaker' }) === true, 'events team flags');
const s = await call(ANA, 'suggestion_create', { p_name: 'Zurich Wealth Days', p_month: '2027-03', p_city: 'Zurich', p_website: '', p_reason: 'EAM crowd' });
ok(await err(call(ANA, 'suggestion_create', { p_name: 'X', p_month: '2027-13', p_city: '', p_website: '', p_reason: '' })) === '23514', 'bad month refused');
ok((await call(ANA, 'bootstrap')).suggestions.length === 1, 'sales see their own suggestion');
const added = await call(ROM, 'suggestion_decide', { p_id: s.id, p_add: true });
const ev = (await call(ANA, 'bootstrap')).events.find(e => e.id === added.eventId);
ok(ev && ev.mode === 'month' && ev.start === '2027-03-01' && ev.tier === null && ev.source === 'suggestion', 'suggestion becomes an unrated event');

console.log('catalogue editing');
ok(await err(call(ANA, 'event_save', { p_id: null, p_data: { name: 'X' } })) === '42501', 'sales cannot add events');
let e2 = await call(ROM, 'event_save', { p_id: null, p_data: { name: 'Crypto Night Vaduz', mode: 'exact', start: '2027-02-10', end: '2027-02-10', city: 'Vaduz', country: 'LI', region: 'EU', tier: 2, fit: [5, 3, 4, null, 2] } });
ok(e2.tier === 2 && e2.fit.join() === '5,3,4,,2' && e2.source === 'manual', 'events team adds an event');
e2 = await call(ROM, 'event_save', { p_id: e2.id, p_data: { ...e2, tier: 3, mode: 'tbd' } });
ok(e2.tier === 3 && e2.start === null && e2.mode === 'tbd', 'and changes it');
ok(await err(call(ROM, 'event_save', { p_id: null, p_data: { name: 'Bad', mode: 'exact', start: '2027-02-10', end: '2027-02-01' } })) === '23514', 'end before start refused');
await call(ROM, 'event_archive', { p_id: e2.id, p_archived: true });
ok(!(await call(ANA, 'bootstrap')).events.some(e => e.id === e2.id) && (await call(ROM, 'bootstrap')).events.some(e => e.id === e2.id), 'archived: hidden for sales, visible for the events team');

console.log('accounts');
ok(await err(call(ROM, 'people_admin')) === '42501', 'only admins manage accounts');
const people = await call(ADM, 'people_admin');
ok(people.length === 5 && people.every(p => p.email), 'admin sees everyone with e-mail');
let p = await call(ADM, 'person_save', { p_id: BEN, p_name: 'Ben Beispiel', p_role: 'sales', p_market: 'Austria', p_team: 'DACH', p_title: 'Relationship Manager', p_active: true });
ok(p.market === 'Austria' && p.initials === 'BB', 'admin sets market, team, title');
ok(await err(call(ADM, 'person_save', { p_id: ADM, p_name: 'Lukas Example', p_role: 'sales', p_market: '', p_team: '', p_title: '', p_active: true })) === '22023', 'cannot remove own admin access');
await call(ADM, 'person_save', { p_id: BEN, p_name: 'Ben Beispiel', p_role: 'sales', p_market: 'Austria', p_team: 'DACH', p_title: '', p_active: false });
ok(await err(call(BEN, 'bootstrap')) === '42501', 'deactivated: no access');
ok(!(await call(ANA, 'bootstrap')).people.some(x => x.id === BEN), 'deactivated people hidden from sales');
ok((await call(ROM, 'activity_feed', { p_limit: 100 })).length > 10, 'activity is logged');
ok(await err(call(ANA, 'activity_feed', { p_limit: 10 })) === '42501', 'sales cannot read the activity log');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
