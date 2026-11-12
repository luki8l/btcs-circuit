import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { LOCAL } from '@/lib/rpc';

export async function POST(req: Request) {
  if (LOCAL) (await cookies()).delete('circuit-local-user');
  else await (await supabaseServer()).auth.signOut();
  if ((req.headers.get('content-type') || '').includes('form')) return NextResponse.redirect(new URL('/login', req.url), 303);
  return NextResponse.json({ ok: true });
}
