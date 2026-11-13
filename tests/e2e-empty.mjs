// The first-day experience: no requests yet (local app WITHOUT CIRCUIT_LOCAL_DEMO). node tests/e2e-empty.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3100', OUT = '.e2e-shots/empty-';
const errs = [];
const b = await chromium.launch();
async function as(email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`${email}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${email} PAGEERR: ${e.message}`));
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', 'demo');
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type=submit]')]);
  await p.waitForLoadState('networkidle');
  if (await p.waitForSelector('.tour-offer', { timeout: 3000 }).catch(() => null)) await p.click('.tour-offer >> text=Not now');
  return p;
}
const ov = async (p, tag) => { const o = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (o[0] > o[1] + 1) errs.push(`OVERFLOW ${tag} ${o}`); };
let p = await as('sales.demo@example.com');
await p.waitForSelector('.erow'); await p.screenshot({ path: OUT + '01-sales-events.png' });
await p.goto(BASE + '/my'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '02-sales-my.png' });
await p.goto(BASE + '/team'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '03-sales-team.png' });
await p.context().close();
p = await as('ceo.demo@example.com'); await p.waitForSelector('.kpis'); await p.screenshot({ path: OUT + '04-ceo-overview.png', fullPage: true }); await ov(p, 'ceo');
await p.goto(BASE + '/approvals'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '05-ceo-requests.png' });
await p.context().close();
p = await as('roman@example.com'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '06-roman-requests.png' }); await p.context().close();
p = await as('sales.demo@example.com', { width: 390, height: 844 }); await p.waitForSelector('.erow'); await p.screenshot({ path: OUT + '07-mobile-events.png' }); await ov(p, 'mobile');
await p.click('.erow >> nth=0'); await p.waitForSelector('.drawer'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '08-mobile-drawer.png' });
await p.click('.dr-f >> text=Request a spot'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '09-mobile-request.png' });
await p.context().close();
p = await as('ceo.demo@example.com', { width: 390, height: 844 }); await p.waitForSelector('.kpis'); await p.screenshot({ path: OUT + '10-mobile-ceo.png' }); await ov(p, 'mobile-ceo'); await p.context().close();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const lp = await c.newPage(); await lp.goto(BASE + '/login'); await lp.waitForTimeout(300); await lp.screenshot({ path: OUT + '00-login.png' });
await b.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
