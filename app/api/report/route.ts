// Downloads for management and the events team: /api/report?format=xlsx (all data) or ?format=pdf (the management report).
// Same data and rules as the app: loaded as the signed-in user; sales get no report.
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { rpcClient, statusOf, messageOf } from '@/lib/rpc';
import { canSeeInsights, ymd, type Data } from '@/lib/model';
import { buildReport } from '@/lib/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format');
  if (format !== 'xlsx' && format !== 'pdf') return NextResponse.json({ error: 'format must be xlsx or pdf' }, { status: 400 });
  let data: Data;
  try { data = await (await rpcClient())<Data>('bootstrap'); }
  catch (e) { return NextResponse.json({ error: messageOf(e) }, { status: statusOf(e) }); }
  if (!canSeeInsights(data.me.role)) return NextResponse.json({ error: 'Reports are for Roman and management.' }, { status: 403 });
  const R = buildReport(data), name = `Circuit-events-report-${ymd(new Date())}`;
  try {
    if (format === 'xlsx') {
      const { buildXlsx } = await import('@/lib/xlsx');
      const buf = await buildXlsx(R, data.me.name);
      return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${name}.xlsx"`, 'cache-control': 'no-store' } });
    }
    const { buildPdf } = await import('@/lib/pdf');
    const logo = await fs.readFile(path.join(process.cwd(), 'public', 'logo-dark.png')).catch(() => null);
    const buf = await buildPdf(R, data.me.name, logo);
    return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}.pdf"`, 'cache-control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'The report could not be created. Try again.' }, { status: 500 });
  }
}
