// The walkthrough for every role, step by step (local app, CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1, port 3100):
//   node tests/e2e-tour.mjs [baseUrl]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3100', OUT = '.e2e-shots/tour-';
const errs = [], report = [];
const b = await chromium.launch();
async function run(email, tag, vp = { width: 1440, height: 900 }, pw = 'demo') {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${tag} PAGEERR: ${e.message}`));
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', pw);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type=submit]')]);
  await p.waitForLoadState('networkidle');
  // first visit: the offer shows up, start from there
  await p.waitForSelector('.tour-offer', { timeout: 5000 }).catch(() => errs.push(`${tag}: no first-visit offer`));
  await p.click('.tour-offer >> text=Start the walkthrough');
  let n = 0;
  for (;;) {
    await p.waitForSelector('.tour-card:not(.wait)', { timeout: 8000 });
    await p.waitForTimeout(450);
    const k = await p.textContent('.tour-card .k'), t = await p.textContent('.tour-card h3');
    const spot = await p.$eval('.tour-spot', s => s.classList.contains('none') ? 'center' : 'pointed');
    const inView = await p.evaluate(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(); return c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1; });
    if (!inView) errs.push(`${tag}: card off screen at "${t}"`);
    report.push(`${tag} ${k} · ${t} · ${spot} · ${new URL(p.url()).pathname}`);
    await p.screenshot({ path: `${OUT}${tag}-${String(++n).padStart(2, '0')}.png` });
    const btn = (await p.textContent('.tour-card .btn.red')).trim();
    if (btn === 'Done') { await p.click('.tour-card .btn.red'); break; }
    if (n === 3) { await p.keyboard.press('ArrowRight'); } else await p.click('.tour-card .btn.red');
    if (n > 20) { errs.push(`${tag}: tour does not end`); break; }
  }
  await p.waitForTimeout(400);
  if (await p.$('.tour, .drawer')) errs.push(`${tag}: tour or drawer still open after Done`);
  await p.reload(); await p.waitForTimeout(1500);
  if (await p.$('.tour-offer')) errs.push(`${tag}: offer shown again after finishing`);
  // restart from the top-bar button, close with Escape
  await p.click('.tour-btn'); await p.waitForSelector('.tour-card'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  if (await p.$('.tour')) errs.push(`${tag}: Escape does not close`);
  await ctx.close();
}
await run('sara@example.com', 'sales');
await run('roman@example.com', 'events');
await run('ceo@example.com', 'ceo');
await run('lukas@example.com', 'admin');
await run('sara@example.com', 'mobile', { width: 390, height: 844 });
await b.close();
console.log(report.join('\n'));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'No errors');
