// Health check for the hosting platform (no sign-in needed, no secrets): is the app up, can it reach the database?
import { NextResponse } from 'next/server';
import { backend, isPostgres } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'ok' | 'error' | 'not checked' = 'not checked';
  if (isPostgres()) {
    try { const { pool } = await import('@/lib/pgdb'); await pool().query('select 1'); db = 'ok'; } catch { db = 'error'; }
  }
  return NextResponse.json({ ok: db !== 'error', backend: backend(), db, version: process.env.CIRCUIT_VERSION || null },
    { status: db === 'error' ? 503 : 200, headers: { 'cache-control': 'no-store' } });
}
