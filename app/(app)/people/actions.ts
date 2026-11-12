'use server';
// Accounts: only admins. Creating a login needs the Supabase secret key (server only); everything else goes
// through the database functions, which check the admin role again.
import { headers } from 'next/headers';
import { z } from 'zod';
import { rpcClient, messageOf, LOCAL } from '@/lib/rpc';
import { supabaseAdmin } from '@/lib/admin';

export type Res = { ok?: boolean; err?: string; link?: string; email?: string };
const Role = z.enum(['admin', 'events', 'management', 'sales']);
const NewPerson = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email().max(200), role: Role, market: z.string().trim().max(60), team: z.string().trim().max(60), title: z.string().trim().max(80) });

async function requireAdmin() {
  const me = await (await rpcClient())<{ role: string }>('me');
  if (me.role !== 'admin') throw new Error('Only admins manage accounts.');
}
async function origin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')}://${host}`;
}
async function linkFor(email: string, uid?: string): Promise<string> {
  if (LOCAL) return `${await origin()}/auth/confirm?local=${uid}`;
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.properties?.hashed_token) throw new Error(error?.message || 'Could not create a sign-in link.');
  return `${await origin()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
}

export async function createPerson(input: unknown): Promise<Res> {
  try {
    await requireAdmin();
    const p = NewPerson.parse(input);
    const meta = { name: p.name, market: p.market, team: p.team, title: p.title };
    let uid: string;
    if (LOCAL) { uid = await (await import('@/lib/localdb')).localCreateUser(p.email, meta, p.role); }
    else {
      const { data, error } = await supabaseAdmin().auth.admin.createUser({ email: p.email, email_confirm: true, user_metadata: meta, app_metadata: { role: p.role } });
      if (error) return { err: /already/i.test(error.message) ? 'There is already an account with this e-mail.' : error.message };
      uid = data.user!.id;
    }
    return { ok: true, email: p.email, link: await linkFor(p.email, uid) };
  } catch (e) {
    if (e instanceof z.ZodError) return { err: 'Check the fields: ' + e.issues.map(i => i.path.join('.')).join(', ') };
    return { err: e instanceof Error ? messageOf(e) : 'Something went wrong.' };
  }
}

export async function newLink(email: string, uid: string): Promise<Res> {
  try { await requireAdmin(); return { ok: true, email, link: await linkFor(z.string().email().parse(email), uid) }; }
  catch (e) { return { err: e instanceof Error ? messageOf(e) : 'Something went wrong.' }; }
}

export async function savePerson(input: { id: string; name: string; role: string; market: string; team: string; title: string; active: boolean }): Promise<Res> {
  try {
    const rpc = await rpcClient();
    await rpc('person_save', { p_id: input.id, p_name: input.name, p_role: input.role, p_market: input.market, p_team: input.team, p_title: input.title, p_active: input.active });
    if (!LOCAL) await supabaseAdmin().auth.admin.updateUserById(input.id, { app_metadata: { role: input.role } }).catch(() => null);
    return { ok: true };
  } catch (e) { return { err: messageOf(e) }; }
}
