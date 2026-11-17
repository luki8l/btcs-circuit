// Sign-in throttle (server only): too many wrong passwords for one e-mail from one network address → wait 15 minutes.
// Counted in the database (public.login_wait / login_note, secret key only), so it holds across server instances.
// If the check itself fails, sign-in still works (logged), so an outage of the counter never locks people out.
import { headers } from 'next/headers';
import { supabaseAdmin } from './admin';

const LOCAL = process.env.NODE_ENV === 'development' && process.env.CIRCUIT_LOCAL_DB === '1';

async function clientIp() {
  const h = await headers();   // set by Vercel from the connection, not by the browser
  return (h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || '').trim().slice(0, 64);
}

/** seconds to wait before this e-mail may try again from here; 0 = go ahead */
export async function loginWait(email: string): Promise<number> {
  if (LOCAL) return 0;
  try {
    const { data, error } = await supabaseAdmin().rpc('login_wait', { p_email: email, p_ip: await clientIp() });
    if (error) throw error;
    return Number(data) || 0;
  } catch (e) { console.error('sign-in throttle (check)', e); return 0; }
}

export async function loginNote(email: string, ok: boolean) {
  if (LOCAL) return;
  try {
    const { error } = await supabaseAdmin().rpc('login_note', { p_email: email, p_ip: await clientIp(), p_ok: ok });
    if (error) throw error;
  } catch (e) { console.error('sign-in throttle (note)', e); }
}

export const waitText = (s: number) => `Too many attempts. Please wait ${Math.max(1, Math.ceil(s / 60))} minute${s > 60 ? 's' : ''} and try again.`;
