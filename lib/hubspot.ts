// HubSpot API (server only). The service key lives in the HUBSPOT_SERVICE_KEY environment variable (Vercel, sensitive)
// and is never sent to the browser or written anywhere else.
const BASE = 'https://api.hubapi.com';

export const hubspotConfigured = () => !!process.env.HUBSPOT_SERVICE_KEY;

export type HsResult<T = unknown> = { ok: boolean; status: number; data?: T; error?: string; missingScopes?: string[] };

/** one GET against HubSpot; never throws, errors come back as { ok:false } with HubSpot's own reason */
export const hsGet = <T = unknown>(path: string) => hsCall<T>('GET', path);

/** the scopes this key has (HubSpot's token-info call; the key itself goes in the body, as HubSpot asks) */
export const hsScopes = () => hsCall<{ scopes?: string[]; hubId?: number }>('POST', '/oauth/v2/private-apps/get/access-token-info', { tokenKey: process.env.HUBSPOT_SERVICE_KEY });

async function hsCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<HsResult<T>> {
  const key = process.env.HUBSPOT_SERVICE_KEY;
  if (!key) return { ok: false, status: 0, error: 'HUBSPOT_SERVICE_KEY is not set' };
  try {
    const r = await fetch(BASE + path, {
      method, headers: { authorization: `Bearer ${key}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    const res = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (r.ok) return { ok: true, status: r.status, data: res as T };
    const ctx = (res?.context || {}) as Record<string, unknown>;
    const scopes = [ctx.requiredGranularScopes, ctx.requiredScopes, ctx.missingScopes].flat().filter((x): x is string => typeof x === 'string');
    return { ok: false, status: r.status, error: String(res?.message || res?.category || r.statusText).slice(0, 300), missingScopes: scopes.length ? scopes : undefined };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'request failed' };
  }
}
