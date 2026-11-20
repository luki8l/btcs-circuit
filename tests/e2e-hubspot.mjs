// HubSpot panel, end to end against the local fake HubSpot (nothing leaves the machine).
// Start: CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1 CIRCUIT_HUBSPOT_FAKE=1 CIRCUIT_LOCAL_ADMINS=lukas@example.com npx next dev -p 3100
// Run:   node tests/e2e-hubspot.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3100';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const errs = [];

async function login(b, email) {
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  const p = await c.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/status of 40[03]/.test(m.text())) errs.push(email + ': ' + m.text()); });
  p.on('pageerror', e => errs.push(email + ' PAGEERR: ' + e.message));
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', 'demo');
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  if (await p.waitForSelector('.tour-offer', { timeout: 4000 }).catch(() => null)) await p.click('.tour-offer >> text=Not now');
  return { c, p };
}
async function openEvent(p, name) {
  await p.goto(BASE + '/catalogue'); await p.waitForSelector('.tbl tbody tr');
  await p.fill('input[aria-label="Search"]', name); await p.waitForTimeout(400);
  await p.locator('.tbl tbody tr', { hasText: name }).first().click();
  await p.waitForSelector('.drawer .hs');
}
const confirm = async (p, label, sure) => { await p.locator('.hs button', { hasText: label }).first().click(); await p.locator('.hs button', { hasText: sure }).click(); };
const toastSays = (p, text) => p.waitForSelector(`.toast:has-text("${text}")`, { timeout: 10000 }).then(() => true).catch(() => false);

(async () => {
  const b = await chromium.launch();
  console.log('Roman: link, update, times, unlink, create');
  const { p } = await login(b, 'roman@example.com');
  await openEvent(p, 'Bitcoin Amsterdam');
  ok(/Not in HubSpot yet/.test(await p.textContent('.hs')), 'starts "Not in HubSpot yet"');
  await p.click('.hs >> text=Prepare for HubSpot'); await p.waitForSelector('.hs-t');
  const sent = await p.textContent('.hs-t');
  ok(/Bitcoin Amsterdam/.test(sent) && /Amsterdam, Netherlands/.test(sent), 'preview: name and "Amsterdam, Netherlands"');
  ok(await p.locator('.hs-c', { hasText: 'Bitcoin Amsterdam' }).count() === 1, 'finds the existing HubSpot event with the same name');
  ok(await p.locator('.hs button', { hasText: 'Create a new one anyway' }).count() === 1, 'with a twin, creating is "a new one anyway"');
  await p.click('.hs-c >> text=Link this one');
  ok(await toastSays(p, 'Linked to the HubSpot event'), 'linked (no write to HubSpot)');
  await p.waitForSelector('.hs .pill.ok');
  await p.click('.hs >> text=Check HubSpot'); await p.waitForSelector('.hs-t');
  ok(await p.locator('.hs-diff').count() >= 2, 'linked: differences to HubSpot are marked (location, dates)');
  await confirm(p, 'Update in HubSpot', 'Yes, overwrite the fields in red');
  ok(await toastSays(p, 'Updated in HubSpot'), 'update sent');
  await p.click('.hs >> text=Check HubSpot'); await p.waitForSelector('.hs-t');
  ok(await p.locator('.hs-diff').count() === 0 && /HubSpot is up to date/.test(await p.textContent('.hs')), 'after update: HubSpot matches Circuit, says up to date');
  // times
  await p.click('.drawer >> text=Edit event'); await p.waitForSelector('#est');
  ok(/Amsterdam time/.test(await p.textContent('#edForm')), 'editor says times are Amsterdam time');
  await p.fill('#est', '09:30'); await p.fill('#eet', '18:00');
  await p.click('button[form=edForm]'); await p.waitForSelector('.drawer .hs');
  ok(await p.waitForFunction(() => /09:30–18:00 Amsterdam time/.test(document.querySelector('.dr-meta')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false), 'event shows "09:30–18:00 Amsterdam time"');
  await p.click('.hs >> text=Check HubSpot'); await p.waitForSelector('.hs-t');
  ok(await p.locator('.hs-diff').count() === 2 && /09:30/.test(await p.textContent('.hs-t')), 'new times show as changes to send');
  await confirm(p, 'Unlink', 'Yes, unlink');
  ok(await toastSays(p, 'Unlinked from HubSpot'), 'unlinked');
  await p.waitForFunction(() => /Not in HubSpot yet/.test(document.querySelector('.hs')?.textContent || ''));
  ok(true, 'back to "Not in HubSpot yet"');
  await p.click('.hs >> text=Prepare for HubSpot'); await p.waitForSelector('.hs-t');
  ok(await p.locator('.hs-c .tag', { hasText: 'Same name and date' }).count() === 1 && await p.locator('.hs button', { hasText: 'Create a new one anyway' }).count() === 1, 'same local day in HubSpot (stored in UTC) still counts as the same event');
  await p.click('.hs >> text=Close');
  // create a new one (no look-alike)
  await openEvent(p, 'Sibos');
  await p.click('.hs >> text=Prepare for HubSpot'); await p.waitForSelector('.hs-t');
  ok(await p.locator('.hs-c').count() === 0, 'Sibos: nothing similar in HubSpot');
  await confirm(p, 'Create in HubSpot', 'Yes, create it in HubSpot');
  ok(await toastSays(p, 'Created in HubSpot'), 'created');
  await p.waitForSelector('.hs .pill.ok');
  ok(!(await p.evaluate(() => window.__csp.length)), 'no blocked scripts or styles');

  console.log('sales');
  const s = await login(b, 'ana@example.com');
  const st = await s.p.evaluate(async () => (await fetch('/api/hubspot/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 1, action: 'preview' }) })).status);
  ok(st === 403, 'sales cannot use HubSpot actions (' + st + ')');
  await b.close();
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
