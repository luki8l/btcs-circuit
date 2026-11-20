// HubSpot API (server only). The service key lives in the HUBSPOT_SERVICE_KEY environment variable (Vercel, sensitive)
// and is never sent to the browser or written anywhere else.
const BASE = 'https://api.hubapi.com';

export const hubspotConfigured = () => !!process.env.HUBSPOT_SERVICE_KEY;

export type HsResult<T = unknown> = { ok: boolean; status: number; data?: T; error?: string; missingScopes?: string[] };

/** one GET against HubSpot; never throws, errors come back as { ok:false } with HubSpot's own reason */
export async function hsGet<T = unknown>(path: string): Promise<HsResult<T>> {
  const key = process.env.HUBSPOT_SERVICE_KEY;
  if (!key) return { ok: false, status: 0, error: 'HUBSPOT_SERVICE_KEY is not set' };
  try {
    const r = await fetch(BASE + path, { headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const body = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (r.ok) return { ok: true, status: r.status, data: body as T };
    const ctx = (body?.context || {}) as Record<string, unknown>;
    const scopes = [ctx.requiredGranularScopes, ctx.requiredScopes, ctx.missingScopes].flat().filter((x): x is string => typeof x === 'string');
    return { ok: false, status: r.status, error: String(body?.message || body?.category || r.statusText).slice(0, 300), missingScopes: scopes.length ? scopes : undefined };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'request failed' };
  }
}
