// Suggestions end to end: sales give what they know, Roman sends one back with a reason, sales improve and resend,
// Roman adds both and the editor already holds the details.
// Start: CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1 CIRCUIT_LOCAL_ADMINS=lukas@example.com npx next dev -p 3100
// Run:   node tests/e2e-suggest.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3100';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const errs = [];
const tag = Date.now().toString(36).slice(-4);
const FULL = `Lisbon Digital Assets Summit ${tag}`, VAGUE = `Vague Summit ${tag}`;

async function login(b, email) {
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  const p = await c.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(email + ': ' + m.text()); });
  p.on('pageerror', e => errs.push(email + ' PAGEERR: ' + e.message));
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', 'demo');
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  if (await p.waitForSelector('.tour-offer', { timeout: 4000 }).catch(() => null)) await p.click('.tour-offer >> text=Not now');
  return p;
}
const toastSays = (p, text) => p.waitForSelector(`.toast:has-text("${text}")`, { timeout: 10000 }).then(() => true).catch(() => false);
const sugTab = async p => { await p.goto(BASE + '/approvals'); await p.click('button[role=tab]:has-text("Suggestions")'); };

(async () => {
  const b = await chromium.launch();
  console.log('sales: suggest with details, and one with only a name');
  const a = await login(b, 'ana@example.com');
  await a.goto(BASE + '/my'); await a.waitForSelector('main');           // sets "last seen"
  await a.click('button:has-text("Suggest an event")'); await a.waitForSelector('#sugForm');
  ok(/Still open: dates, city, country, website/.test(await a.textContent('#sugForm')), 'empty form says what is still open');
  await a.fill('#sname', FULL); await a.fill('#ss', '2027-05-12'); await a.fill('#se', '2027-05-13'); await a.fill('#sst', '09:00'); await a.fill('#set', '18:00');
  await a.fill('#scity', 'Lisbon'); await a.fill('#scountry', 'PT'); await a.fill('#sweb', 'https://example.com/ldas'); await a.fill('#swhy', 'Our Portugal clients go');
  ok(/Lisbon time/.test(await a.textContent('#sugForm')), 'times are labelled Lisbon time');
  await a.click('#sugForm summary'); await a.fill('#skind', 'Crypto'); await a.selectOption('#ssize', 'M'); await a.fill('#sticket', 'EUR 900');
  ok(/All key facts are in/.test(await a.textContent('#sugForm')), 'complete form says "All key facts are in"');
  await a.click('button[form=sugForm]'); ok(await toastSays(a, 'Sent to Roman'), 'sent');
  await a.click('button:has-text("Suggest an event")'); await a.waitForSelector('#sugForm');
  await a.fill('#sname', VAGUE); await a.click('button[form=sugForm]'); ok(await toastSays(a, 'Sent to Roman'), 'name-only suggestion sent');
  await a.goto(BASE + '/discover'); await a.waitForSelector('main');   // away from My events while Roman decides

  console.log('Roman: sees the details, sends the vague one back');
  const r = await login(b, 'roman@example.com');
  await sugTab(r);
  const card = r.locator('.sug', { hasText: FULL });
  const ct = await card.textContent();
  ok(/12–13 May 2027 · 09:00–18:00/.test(ct) && /Lisbon, Portugal/.test(ct) && /Crypto/.test(ct) && /EUR 900/.test(ct), 'card shows dates, times, place, type, ticket');
  const v = r.locator('.sug', { hasText: VAGUE });
  ok(/No date yet · No place yet/.test(await v.textContent()), 'vague one shows what is missing');
  await v.locator('button:has-text("Not now")').click();
  await v.locator('.chip', { hasText: 'Too vague' }).click();
  ok(/exact dates, city and website/.test(await v.locator('textarea').inputValue()), 'quick reason fills the note');
  await v.locator('button:has-text("Send back to")').click(); ok(await toastSays(r, 'Sent back to'), 'sent back');

  console.log('sales: sees why, improves and resends');
  await a.goto(BASE + '/discover'); await a.waitForSelector('main');
  const badge = await a.waitForSelector('.cnt', { timeout: 5000 }).then(() => a.locator('.cnt').allTextContents()).catch(() => []);
  await a.goto(BASE + '/my'); await a.waitForSelector('main');
  const mine = a.locator('.mine', { hasText: VAGUE });
  await mine.locator('.tag.new').waitFor({ timeout: 5000 }).catch(() => {});
  const mt = await mine.textContent();
  ok(/Not added/.test(mt) && /exact dates, city and website/.test(mt) && /New/.test(mt), 'shows "Not added", Roman\'s note and "New"');
  ok(badge.length > 0, 'My events badge counts it (before opening My events)');
  await mine.locator('button:has-text("Improve and resend")').click(); await a.waitForSelector('#sugForm');
  ok(/exact dates, city and website/.test(await a.textContent('#sugForm')) && await a.inputValue('#sname') === VAGUE, 'form opens with the name and Roman\'s note');
  await a.click('#sugForm button:has-text("Month")'); await a.fill('#smonth', '2027-09');
  await a.fill('#scity', 'Zurich'); await a.fill('#scountry', 'CH'); await a.fill('#sweb', 'https://example.com/vague');
  await a.click('button[form=sugForm]'); ok(await toastSays(a, 'Sent to Roman again'), 'resent');
  ok(await a.locator('.mine', { hasText: VAGUE }).locator('.pill:has-text("Waiting for Roman")').waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'waiting again');

  console.log('Roman: adds both, the editor holds the details');
  await sugTab(r);
  const v2 = r.locator('.sug', { hasText: VAGUE });
  ok(/You sent it back/.test(await v2.textContent()) && /Sep 2027 · Zurich, Switzerland/.test(await v2.textContent()), 'sees it came back improved');
  await v2.locator('button:has-text("Add to calendar")').click(); await r.waitForSelector('#edForm');
  ok(await r.inputValue('#ec') === 'Zurich' && await r.inputValue('#eco') === 'CH' && await r.inputValue('#ew') === 'https://example.com/vague', 'editor: city, country, website filled');
  await r.selectOption('#et', '3'); await r.click('button[form=edForm]'); await r.waitForSelector('.drawer .dr-meta');
  ok(/Sep 2027/.test(await r.textContent('.dr-meta')), 'saved as a September event');
  await sugTab(r);
  await r.locator('.sug', { hasText: FULL }).locator('button:has-text("Add to calendar")').click(); await r.waitForSelector('#edForm');
  ok(await r.inputValue('#es') === '2027-05-12' && await r.inputValue('#ee') === '2027-05-13' && await r.inputValue('#est') === '09:00' && await r.inputValue('#ek') === 'Crypto' && await r.inputValue('#esz') === 'M', 'editor: exact dates, times, type, size filled');
  ok(await r.inputValue('#er') === 'EU', 'region set from the country (Portugal → Europe)');
  await r.click('button[form=edForm]'); await r.waitForSelector('.drawer .dr-meta');
  ok(/09:00–18:00 Lisbon time/.test(await r.textContent('.dr-meta')), 'event shows "09:00–18:00 Lisbon time"');
  ok(!(await r.evaluate(() => window.__csp.length)) && !(await a.evaluate(() => window.__csp.length)), 'no blocked scripts or styles');

  await b.close();
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
