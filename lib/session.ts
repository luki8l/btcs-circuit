// Sessions in postgres mode: a signed token in an HttpOnly cookie (HS256, CIRCUIT_SESSION_SECRET).
// Edge-safe (middleware checks the signature); the database checks on every call that the account is active and
// the session was not ended by "sign out on all other devices" (auth.session_ok()).
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'circuit_session';
export const OIDC_COOKIE = 'circuit_oidc';
export const sessionDays = () => Math.min(Math.max(Number(process.env.CIRCUIT_SESSION_DAYS) || 30, 1), 400);

function key() {
  const s = process.env.CIRCUIT_SESSION_SECRET || '';
  if (s.length < 32) throw new Error('CIRCUIT_SESSION_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(s);
}
const AUD = 'circuit';

/** session token for a user; iat = when the session started (from the database clock) */
export async function signSession(sub: string, iat: number) {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt(iat)
    .setExpirationTime(iat + sessionDays() * 86400).setIssuer(AUD).setAudience(AUD).sign(key());
}
export async function readSession(token: string | undefined): Promise<{ sub: string; iat: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: AUD, audience: AUD, algorithms: ['HS256'] });
    return typeof payload.sub === 'string' && typeof payload.iat === 'number' && !payload.flow ? { sub: payload.sub, iat: payload.iat } : null;
  } catch { return null; }
}

/** short-lived state of a Microsoft sign-in in progress (PKCE verifier, state, nonce, where to go after) */
export async function signFlow(v: Record<string, string>) {
  return new SignJWT({ ...v, flow: 1 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').setIssuer(AUD).setAudience(AUD + ':oidc').sign(key());
}
export async function readFlow(token: string | undefined): Promise<Record<string, string> | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key(), { issuer: AUD, audience: AUD + ':oidc', algorithms: ['HS256'] }); return payload as Record<string, string>; } catch { return null; }
}

export const cookieBase = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production' };
