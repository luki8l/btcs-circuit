// postgres mode end to end: real PostgreSQL, the production server (standalone), Microsoft sign-in against a
// stand-in OpenID provider (tests/mock-oidc.mjs, started here). Setup in docs/HANDOVER.md → "Testing the Azure mode".
//   Usually run by tests/postgres-e2e.sh (fresh database, server, this test). By hand: APP=http://localhost:3300 node tests/e2e-postgres.mjs
// Needs these accounts in the database: sara@example.com (sales), roman@example.com (events), admin@example.com (admin).
import { createRequire } from 'node:module';
import { startMockOidc } from './mock-oidc.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const APP = process.env.APP || 'http://localhost:3300';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const errs = [];
const NEW = `neu-${Date.now().toString(36)}@example.com`;

async function ctx(b, tag) {
  const c = await b.newContext({ viewport: { width: 1440, height: 950 }, timezoneId: 'Europe/Vienna' });   // server runs in UTC, people in Vienna: dates must still match
  await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(tag + ' PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/status of 40[13]|Failed to load resource/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  return { c, p };
}
/** go to the app; if the stand-in Microsoft asks, sign in as `who` */
async function signIn(p, who, path = '/') {
  await p.goto(APP + path);
  for (let i = 0; i < 4; i++) {
    await p.waitForLoadState('domcontentloaded');
    const u = new URL(p.url());
    if (u.origin === APP) return u;
    if (await p.locator('input[name=login]').count()) { await p.fill('input[name=login]', who); await p.fill('input[name=password]', 'x'); await p.click('button[type=submit]'); continue; }
    if (await p.locator('button[type=submit]').count()) { await p.click('button[type=submit]'); continue; }   // consent
    await p.waitForTimeout(500);
  }
  await p.waitForURL(u => u.origin === APP, { timeout: 15000 });
  return new URL(p.url());
}
const dismissTour = async p => { if (await p.waitForSelector('.tour-offer', { timeout: 3000 }).catch(() => null)) await p.click('.tour-offer >> text=Not now'); };
const csp = p => p.evaluate(() => window.__csp || []).catch(() => []);
const session = async c => (await c.cookies()).find(x => x.name === 'circuit_session');

(async () => {
  const mock = await startMockOidc({ port: 3201, appUrl: APP });
  const b = await chromium.launch();
  try {
    const h = await (await fetch(APP + '/api/health')).json();
    ok(h.ok && h.backend === 'postgres' && h.db === 'ok', 'health: postgres mode, database reachable');

    console.log('sales: Microsoft sign-in');
    const A = await ctx(b, 'sara-A');
    let u = await signIn(A.p, 'sara@example.com');
    await dismissTour(A.p);
    ok(u.pathname === '/discover', `signed in, lands on ${u.pathname}`);
    const sc = await session(A.c);
    ok(sc && sc.httpOnly && sc.sameSite === 'Lax', 'session cookie: HttpOnly, SameSite=Lax');
    await A.p.goto(APP + '/account'); await A.p.waitForSelector('.acct');
    const acct = await A.p.textContent('main');
    ok(/Microsoft account/.test(acct) && !/Change password/.test(acct), 'Account: Microsoft sign-in, no password form');
    await A.p.goto(APP + '/set-password'); ok(new URL(A.p.url()).pathname === '/account', '/set-password → Account (no passwords here)');
    ok(!(await csp(A.p)).length, 'no blocked scripts or styles');

    console.log('not allowed in');
    const X = await ctx(b, 'nobody');
    u = await signIn(X.p, 'nobody@example.com');
    ok(u.pathname === '/login' && u.searchParams.get('error') === 'no_account' && /no Circuit account for nobody@example.com/.test(await X.p.textContent('.login-card')), 'unknown person → "no Circuit account", stays out');
    const Y = await ctx(b, 'other-org');
    u = await signIn(Y.p, 'other-org:sara@example.com');
    ok(u.searchParams.get('error') === 'org', 'Microsoft account from another organisation → refused');

    console.log('admin: new account, deactivate');
    const D = await ctx(b, 'admin');
    u = await signIn(D.p, 'admin@example.com', '/people'); await dismissTour(D.p);
    await D.p.waitForSelector('#pn');
    ok(/sign in with Microsoft/.test(await D.p.textContent('.head')) && await D.p.locator('button:has-text("Sign-in link")').count() === 0, 'People: Microsoft wording, no sign-in links');
    await D.p.fill('#pn', 'Neu Person'); await D.p.fill('#pe', NEW); await D.p.click('button:has-text("Create account")');
    ok(await D.p.waitForSelector(`.banner:has-text("Account ready for ${NEW}")`, { timeout: 10000 }).then(() => true).catch(() => false), 'account created, nothing to send');
    const N = await ctx(b, 'new');
    u = await signIn(N.p, NEW); await dismissTour(N.p);
    ok(u.pathname === '/discover', 'the new person signs in with Microsoft right away');
    await D.p.goto(APP + '/people'); await D.p.waitForSelector('tbody tr');
    const row = D.p.locator('tbody tr', { hasText: NEW });
    await row.locator('button:has-text("Edit")').click();
    await D.p.locator('tbody tr', { has: D.p.locator('button:has-text("Save")') }).locator('button.chip[aria-pressed="true"]').click();
    await D.p.click('button:has-text("Save")'); await D.p.waitForTimeout(1500);
    await N.p.goto(APP + '/discover'); await N.p.waitForLoadState('networkidle').catch(() => {});
    u = new URL(N.p.url());
    for (let i = 0; i < 5 && u.origin !== APP; i++) { await N.p.waitForTimeout(800); u = new URL(N.p.url()); }
    ok(u.pathname === '/login' && u.searchParams.get('error') === 'inactive', `deactivated: the open session ends at once (${u.pathname}${u.search})`);

    console.log('sign out on all other devices');
    const B = await ctx(b, 'sara-B');
    await signIn(B.p, 'sara@example.com'); await dismissTour(B.p);
    const oldB = (await session(B.c)).value;
    await A.p.goto(APP + '/account'); await A.p.click('button:has-text("Sign out on all other devices")');
    ok(await A.p.waitForSelector('button:has-text("Signed out on other devices")', { timeout: 8000 }).then(() => true).catch(() => false), 'device A: done');
    const r = await fetch(APP + '/api/act', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `circuit_session=${oldB}` }, body: JSON.stringify({ fn: 'activity_feed', args: { p_limit: 1 } }) });
    ok(r.status === 401, `device B's old session no longer works (${r.status})`);
    await A.p.goto(APP + '/my'); ok(new URL(A.p.url()).pathname === '/my', 'device A stays signed in');

    console.log('approve (database arrays, JSON) and sign out');
    const R = await ctx(b, 'roman');
    await signIn(R.p, 'roman@example.com', '/approvals'); await dismissTour(R.p);
    await R.p.waitForSelector('button[aria-label^="Approve "]');
    const before = await R.p.locator('button[aria-label^="Approve "]').count();
    await R.p.locator('button[aria-label^="Approve "]').first().click();
    await R.p.waitForFunction(n => document.querySelectorAll('button[aria-label^="Approve "]').length < n, before, { timeout: 10000 }).catch(() => {});
    ok(await R.p.locator('button[aria-label^="Approve "]').count() === before - 1, 'Roman approves a request');
    await R.p.click('.me, [aria-label="Account menu"], header button:has(.av)').catch(() => {});
    await R.p.evaluate(() => { const f = document.createElement('form'); f.method = 'post'; f.action = '/auth/signout'; document.body.appendChild(f); f.submit(); });
    await R.p.waitForURL(/signedout=1/, { timeout: 10000 }).catch(() => {});
    ok(/signedout=1/.test(R.p.url()) && /You are signed out/.test(await R.p.textContent('.login-card')), 'sign out: stays on the login page (no automatic sign-in)');
    ok(!(await csp(R.p)).length && !(await csp(D.p)).length, 'no blocked scripts or styles (Roman, admin)');
  } finally {
    await b.close(); await mock.close();
  }
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
