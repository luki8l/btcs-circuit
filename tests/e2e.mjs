// Browser walk-through against the local app (CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1, port 3100):
//   node tests/e2e.mjs [baseUrl]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3100', OUT = '.e2e-shots/';
const errs = [];
const b = await chromium.launch();
async function as(email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`${email}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${email} PAGEERR: ${e.message}`));
  await p.goto(BASE + '/login');
  await p.fill('#email', email); await p.fill('#password', 'demo');
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type=submit]')]);
  await p.waitForLoadState('networkidle');
  return p;
}
const shot = (p, n, full = false) => p.screenshot({ path: OUT + n + '.png', fullPage: full });
const ov = async (p, tag) => { const o = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (o[0] > o[1] + 1) errs.push(`OVERFLOW ${tag} ${o}`); };

// sales
let p = await as('sara@example.com');
await p.goto(BASE + '/discover'); await p.waitForSelector('svg.season'); await shot(p, '01-discover'); await ov(p, 'discover');
await p.click('text=Filters'); await p.waitForTimeout(200); await shot(p, '02-filters');
await p.click('.fpanel >> text=T1'); await p.click('.fpanel >> text=T2'); await p.waitForTimeout(200); await shot(p, '03-filtered');
await p.click('text=Clear all');
await p.click('.toolbar .seg >> text=Calendar'); await p.waitForTimeout(300); await shot(p, '04-calendar');
for (let i = 0; i < 1; i++) await p.click('[aria-label="Next month"]'); await p.waitForTimeout(200); await shot(p, '04b-calendar-dec');
await p.click('text=Full screen'); await p.waitForTimeout(300); await shot(p, '05-calendar-full'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('.toolbar .seg >> text=Season'); await p.click('text=Full screen'); await p.waitForTimeout(300); await shot(p, '05b-season-full'); await p.click('.full >> text=Exit');
await p.click('.toolbar .seg >> text=List'); await p.waitForTimeout(300); await shot(p, '06-list');
await p.fill('input[aria-label="Search events"]', 'st. moritz'); await p.waitForTimeout(200);
await p.click('.erow'); await p.waitForSelector('.drawer'); await p.waitForTimeout(300); await shot(p, '07-drawer');
await p.click('text=Request to attend'); await p.waitForTimeout(200);
await p.click('.opt >> text=Paid ticket'); await p.fill('#cost', '4800'); await p.fill('#why', 'Three UHNW prospects confirmed.');
await shot(p, '08-request');
await p.click('button[form=reqForm]'); await p.waitForSelector('text=Request sent'); await shot(p, '09-sent');
await p.click('text=Go to My events'); await p.waitForURL('**/my'); await p.waitForTimeout(400); await shot(p, '10-my', true);
await p.keyboard.press('Meta+k'); await p.waitForSelector('.pal'); await p.keyboard.type('ethcc'); await p.waitForTimeout(150); await shot(p, '11-palette'); await p.keyboard.press('Escape');
await p.goto(BASE + '/team'); await p.waitForSelector('.matrix'); await shot(p, '12-team'); await ov(p, 'team');
await p.context().close();

// events team
p = await as('roman@example.com');
await p.waitForSelector('.tbl'); await shot(p, '20-approvals', true); await ov(p, 'approvals');
await p.click('.tbl tbody tr.click >> nth=1'); await p.waitForTimeout(200); await shot(p, '21-approvals-expanded');
await p.click('.tbl tbody tr.click >> nth=0 >> button.ok'); await p.waitForTimeout(1200);
await p.click('thead .check'); await p.waitForTimeout(150); await shot(p, '22-bulk');
await p.click('.bulk >> text=Cancel');
await p.click('[role=tab] >> text=Coverage gaps'); await p.waitForTimeout(200); await shot(p, '23-coverage');
await p.click('[role=tab] >> text=Suggestions'); await p.waitForTimeout(200); await shot(p, '24-suggestions');
await p.click('[role=tab] >> text=Decided'); await p.waitForTimeout(200); await shot(p, '25-decided');
await p.goto(BASE + '/catalogue'); await p.waitForSelector('.tbl'); await shot(p, '26-catalogue');
await p.click('text=Add event'); await p.waitForSelector('#edForm'); await shot(p, '27-editor'); await p.keyboard.press('Escape');
await p.goto(BASE + '/insights'); await p.waitForSelector('.kpis'); await shot(p, '28-insights', true); await ov(p, 'insights');
await p.context().close();

// admin
p = await as('lukas@example.com');
await p.goto(BASE + '/people'); await p.waitForSelector('#pn');
await p.fill('#pn', 'Anna Testerin'); await p.fill('#pe', 'anna@example.com'); await p.fill('#pm', 'Austria'); await p.fill('#pt', 'DACH');
await p.click('text=Create account'); await p.waitForSelector('text=Account ready'); await shot(p, '30-people', true);
await p.context().close();

// mobile, sales
p = await as('sara@example.com', { width: 390, height: 844 });
await p.goto(BASE + '/discover'); await p.waitForSelector('svg.season'); await shot(p, '40-mobile'); await ov(p, 'mobile-discover');
await p.click('.toolbar .seg >> text=List'); await p.waitForTimeout(200); await shot(p, '41-mobile-list'); await ov(p, 'mobile-list');
await p.click('.erow'); await p.waitForSelector('.drawer'); await p.waitForTimeout(300); await shot(p, '42-mobile-drawer');
await p.goto(BASE + '/my'); await p.waitForTimeout(500); await shot(p, '43-mobile-my'); await ov(p, 'mobile-my');
await p.context().close();
p = await as('roman@example.com', { width: 390, height: 844 }); await p.waitForTimeout(300); await shot(p, '44-mobile-approvals'); await ov(p, 'mobile-approvals');
await p.context().close();

// login page
const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const lp = await c.newPage(); await lp.goto(BASE + '/login'); await lp.waitForTimeout(300); await lp.screenshot({ path: OUT + '00-login.png' });
await b.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
