// Robustness: bad input, other people being faster, archived events, hostile text, long text, double clicks,
// no connection, expired session. Local app with demo data (CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1, port 3100):
//   node tests/robustness.mjs [baseUrl]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3100';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const pageErrs = [];
const b = await chromium.launch();

async function as(email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.on('pageerror', e => pageErrs.push(`${email}: ${e.message}`));
  p.on('dialog', d => { pageErrs.push(`${email}: DIALOG ${d.message()}`); d.dismiss(); });
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', 'demo');
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  await p.waitForLoadState('networkidle');
  if (await p.waitForSelector('.tour-offer', { timeout: 2500 }).catch(() => null)) await p.click('.tour-offer >> text=Not now');
  return p;
}
const api = async (p, fn, args) => { const r = await p.context().request.post(BASE + '/api/act', { data: { fn, args } }); return { s: r.status(), j: await r.json().catch(() => ({})) }; };
const raw = async (ctx, body) => (await ctx.request.post(BASE + '/api/act', { data: body, headers: { 'content-type': 'application/json' } })).status();
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const toastText = async p => (await p.waitForSelector('.toast', { timeout: 6000 }).then(t => t.textContent()).catch(() => '')) || '';
// the list filters right after the first paint: wait until the search is applied
const find = async (p, q, name) => { await p.goto(BASE + '/discover?q=' + encodeURIComponent(q)); await p.waitForFunction(() => document.querySelectorAll('.erow').length > 0 && document.querySelectorAll('.erow').length < 10); return p.locator('.erow', { hasText: name }).first(); };
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ev = (name, extra = {}) => ({ name, website: '', mode: 'exact', start: '2027-05-10', end: '2027-05-11', dateNote: '', region: 'EU', country: 'AT', city: 'Wien', kind: 'Test', focus: '', tier: 3, audience: '', size: '', costTicket: '', costSponsor: '', notes: '', fit: [3, 3, 3, 3, 3], ...extra });

const sara = await as('sara@example.com');
const roman = await as('roman@example.com');

console.log('api: bad input never crashes the server');
const anon = await b.newContext();
ok([401, 403].includes((await anon.request.post(BASE + '/api/act', { data: { fn: 'request_withdraw', args: { p_id: '00000000-0000-0000-0000-000000000000' } } })).status()), 'not signed in: refused');
for (const body of ['not json', 'null', '[]', '{"fn":"constructor"}', '{"fn":"__proto__"}', '{"fn":"toString"}', '{"fn":"bootstrap"}', '{"fn":"request_create","args":null}'])
  ok((await raw(sara.context(), body)) === 400, `body ${body.slice(0, 40)} → 400`);
ok((await api(sara, 'request_create', { p_event: '1', p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 1, p_reason: '' })).s === 400, 'wrong type → 400');
ok((await api(sara, 'request_create', { p_event: 1, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 1, p_reason: 'x'.repeat(3000) })).s === 400, 'text too long → 400');
ok((await api(sara, 'request_create', { p_event: 1, p_mode: 'attend', p_ticket: 'paid', p_cost: -5, p_groups: [0], p_meetings: 1, p_reason: '' })).s === 400, 'negative cost → 400');
ok((await api(sara, 'request_create', { p_event: 999999, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 1, p_reason: '' })).s === 404, 'unknown event → 404');

console.log('api: sales cannot do staff things');
ok((await api(sara, 'request_decide', { p_ids: [UUID], p_status: 'approved', p_note: '' })).s === 403, 'decide → 403');
ok((await api(sara, 'event_save', { p_id: null, p_data: ev('Sneaky') })).s === 403, 'add event → 403');
ok((await api(sara, 'flag_set', { p_event: 1, p_on: true, p_note: '' })).s === 403, 'flag → 403');
ok((await api(sara, 'event_archive', { p_id: 1, p_archived: true })).s === 403, 'archive → 403');

console.log('hostile and long text');
const xss = await api(roman, 'event_save', { p_id: null, p_data: ev('<img src=x onerror="alert(1)">Robust XSS Summit', { city: '<b>Wien</b>', notes: '<script>alert(2)</script>' }) });
ok(xss.s === 200 && xss.j.data?.id, 'events team can add an event with odd characters');
const longName = 'Very Long Conference Name ' + 'Lorem ipsum dolor sit amet '.repeat(6);
const long = await api(roman, 'event_save', { p_id: null, p_data: ev(longName.slice(0, 200), { notes: 'Notes '.repeat(600).slice(0, 4000), costTicket: 'CHF 1’000 '.repeat(25).slice(0, 300) }) });
ok(long.s === 200, 'event with a 200-character name and 4000-character notes');
const sqlish = await api(sara, 'suggestion_create', { p_name: "'; drop table events; --", p_month: '2027-04', p_city: 'Zug', p_website: '', p_reason: "Robert'); DROP TABLE requests;--" });
ok(sqlish.s === 200, 'SQL-looking text is stored as text');
const xrow = await find(sara, 'robust xss', 'Robust XSS');
ok((await xrow.locator('.nm').textContent()).includes('<img src=x'), 'odd characters shown as text');
await xrow.hover(); await xrow.click(); await sara.waitForSelector('.drawer'); await sara.click('text=More from the masterlist').catch(() => {});
await sara.keyboard.press('Escape');
await sara.goto(BASE + '/discover?q=robust%20xss&view=year'); await sara.waitForSelector('.season');
const dot = sara.locator('.season g.dot:not(.dim)').first(); await dot.hover({ force: true }); await sara.waitForTimeout(300);
ok(!(await sara.evaluate(() => !!document.querySelector('#tip img'))), 'tooltip escapes the name (no <img> injected)');
const reason = 'Why: ' + 'meetings with clients '.repeat(80);
const lr = await api(sara, 'request_create', { p_event: long.j.data.id, p_mode: 'attend', p_ticket: 'paid', p_cost: 1234567, p_groups: [0, 1, 2, 3, 4], p_meetings: 500, p_reason: reason.slice(0, 2000) });
ok(lr.s === 200, 'request with the longest allowed reason');
for (const [pg, path] of [[sara, '/discover?q=very%20long'], [sara, '/my'], [sara, '/team'], [roman, '/approvals'], [roman, '/catalogue'], [roman, '/insights']]) {
  await pg.goto(BASE + path); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(300);
  ok(!(await overflow(pg)), `no sideways scrolling on ${path} (${pg === sara ? 'sales' : 'events'})`);
}
await roman.goto(BASE + '/approvals'); await roman.locator('tr.click', { hasText: 'Very Long Conference' }).first().click(); await roman.waitForTimeout(300);
ok(!(await overflow(roman)), 'expanded request with a long reason fits');
const phone = await as('sara@example.com', { width: 390, height: 844 });
for (const path of ['/discover?q=very%20long', '/my', '/team']) { await phone.goto(BASE + path); await phone.waitForLoadState('networkidle'); await phone.waitForTimeout(300); ok(!(await overflow(phone)), `phone: no sideways scrolling on ${path}`); }
await (await find(phone, 'very long', 'Very Long')).click(); await phone.waitForSelector('.drawer'); await phone.waitForTimeout(300);
ok(!(await overflow(phone)), 'phone: long event page fits');
await phone.context().close();

console.log('someone else was faster');
const race = await api(roman, 'event_save', { p_id: null, p_data: ev('Race Condition Forum') });
const rr = await api(sara, 'request_create', { p_event: race.j.data.id, p_mode: 'attend', p_ticket: 'free', p_cost: 0, p_groups: [0], p_meetings: 2, p_reason: '' });
await roman.goto(BASE + '/approvals'); await roman.waitForSelector('tr.click');
const row = roman.locator('tr.click', { hasText: 'Race Condition Forum' });
ok(await row.count() === 1, 'Roman sees the new request');
ok((await api(sara, 'request_withdraw', { p_id: rr.j.data.id })).s === 200, 'sales withdraws while Roman still has it on screen');
await row.locator('button:has-text("Approve")').click();
const t1 = await toastText(roman);
ok(/nothing changed/i.test(t1), `Roman is told nothing changed ("${t1.trim()}")`);
await roman.waitForTimeout(800);
ok(await roman.locator('tr.click', { hasText: 'Race Condition Forum' }).count() === 0, 'and the row is gone after the refresh');

console.log('double click');
await (await find(sara, 'race condition', 'Race Condition Forum')).locator('text=Request a spot').click(); await sara.waitForSelector('#reqForm');
await sara.click('#reqForm .chip >> nth=0');
await sara.locator('button[form=reqForm]').dblclick();
await sara.waitForTimeout(1500);
await sara.goto(BASE + '/my'); await sara.waitForSelector('.mine');
ok(await sara.locator('.mine', { hasText: 'Race Condition Forum' }).count() === 1, 'a double click sends one request');

console.log('archived event with requests');
ok((await api(roman, 'event_archive', { p_id: long.j.data.id, p_archived: true })).s === 200, 'events team archives an event that has a request');
for (const path of ['/my', '/discover', '/team']) { await sara.goto(BASE + path); await sara.waitForLoadState('networkidle'); ok(!(await sara.$('text=Something went wrong')), `sales ${path} still works`); }
for (const path of ['/approvals', '/insights', '/team', '/catalogue']) { await roman.goto(BASE + path); await roman.waitForLoadState('networkidle'); ok(!(await roman.$('text=Something went wrong')), `events team ${path} still works`); }
await api(roman, 'event_archive', { p_id: long.j.data.id, p_archived: false });

console.log('no connection, expired session, unknown page');
await sara.goto(BASE + '/my'); await sara.waitForSelector('.mine');
await sara.context().setOffline(true);
await sara.locator('.mine', { hasText: 'Race Condition Forum' }).locator('text=Withdraw').click(); await sara.click('text=Yes, withdraw');
const t2 = await toastText(sara);
ok(/connection/i.test(t2), `offline: clear message ("${t2.trim()}")`);
await sara.context().setOffline(false);
await sara.context().clearCookies();
await sara.locator('.mine', { hasText: 'Race Condition Forum' }).locator('text=Withdraw').click().catch(() => {}); await sara.click('text=Yes, withdraw').catch(() => {});
await sara.waitForURL('**/login', { timeout: 8000 }).catch(() => {});
ok(new URL(sara.url()).pathname === '/login', 'expired session: back to the login page');
const nf = await roman.goto(BASE + '/this-does-not-exist');
ok(nf.status() === 404 && (await roman.textContent('h1')).includes('not found'), 'unknown page: friendly 404');

await b.close();
ok(!pageErrs.length, 'no browser errors or pop-ups' + (pageErrs.length ? ': ' + pageErrs.join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
