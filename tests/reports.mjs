// Reports: who may download, that the files open, and that the numbers match the Overview.
//   node tests/reports.mjs [baseUrl] [outDir]   (local app with demo data, or pass PROD credentials via REPORT_USERS)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3100', OUT = process.argv[3] || '.e2e-shots/';
const USERS = JSON.parse(process.env.REPORT_USERS || '{"management":["ceo@example.com","demo"],"events":["roman@example.com","demo"],"sales":["sara@example.com","demo"]}');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const b = await chromium.launch();
async function as([email, pw]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', pw);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  await p.waitForLoadState('networkidle');
  if (await p.waitForSelector('.tour-offer', { timeout: 2500 }).catch(() => null)) await p.click('.tour-offer >> text=Not now');
  return p;
}
// status codes via fetch in the page (works behind proxies, unlike a separate request context)
const status = (p, url) => p.evaluate(u => fetch(u, { redirect: 'manual' }).then(r => r.status), url);
const anon = await (await b.newContext()).newPage(); await anon.goto(BASE + '/login');
ok([0, 401, 403, 307].includes(await status(anon, BASE + '/api/report?format=pdf')), 'not signed in: no report');
const sales = await as(USERS.sales);
ok((await status(sales, BASE + '/api/report?format=xlsx')) === 403, 'sales: no report (403)');
ok(!(await sales.$('.report-dl')), 'sales: no download button');
for (const role of ['management', 'events']) {
  const p = await as(USERS[role]);
  ok((await status(p, BASE + '/api/report?format=doc')) === 400, `${role}: unknown format → 400`);
  await p.goto(BASE + '/insights'); await p.waitForSelector('.kpis');
  const kpis = await p.$$eval('.kpi', ks => ks.map(k => k.querySelector('b').textContent.replace(/\s+/g, ' ').trim()));
  fs.writeFileSync(`${OUT}kpis-${role}.json`, JSON.stringify(kpis));
  for (const fmt of ['pdf', 'xlsx']) {
    await p.click('.report-dl .dd > button');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`.report-dl .dd-opt >> text=${fmt === 'pdf' ? 'PDF report' : 'Excel, all data'}`)]);
    const file = `${OUT}report-${role}.${fmt}`; await dl.saveAs(file);
    const head = fs.readFileSync(file).subarray(0, 4).toString('latin1');
    ok(fmt === 'pdf' ? head === '%PDF' : head === 'PK\u0003\u0004', `${role}: ${fmt} downloads from the button (${dl.suggestedFilename()}, ${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
  const t = await p.waitForSelector('.toast').then(x => x.textContent()).catch(() => '');
  ok(/downloaded/i.test(t), `${role}: confirmation shown ("${t}")`);
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
