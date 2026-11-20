// HubSpot API (server only). The service key lives in the HUBSPOT_SERVICE_KEY environment variable (Vercel, sensitive)
// and is never sent to the browser or written anywhere else.
// Local development: CIRCUIT_HUBSPOT_FAKE=1 answers from an in-memory fake instead (nothing leaves the machine).
const BASE = 'https://api.hubapi.com';
const FAKE = process.env.NODE_ENV === 'development' && process.env.CIRCUIT_HUBSPOT_FAKE === '1';

export const hubspotConfigured = () => FAKE || !!process.env.HUBSPOT_SERVICE_KEY;

export type HsResult<T = unknown> = { ok: boolean; status: number; data?: T; error?: string; missingScopes?: string[] };
type Method = 'GET' | 'POST' | 'PATCH';

export const hsGet = <T = unknown>(path: string) => hs<T>('GET', path);

/** the scopes this key has (HubSpot's token-info call; the key itself goes in the body, as HubSpot asks) */
export const hsScopes = () => hs<{ scopes?: string[]; hubId?: number }>('POST', '/oauth/v2/private-apps/get/access-token-info', { tokenKey: process.env.HUBSPOT_SERVICE_KEY });

/** one call to HubSpot; never throws, errors come back as { ok:false } with HubSpot's own reason */
export async function hs<T = unknown>(method: Method, path: string, body?: unknown): Promise<HsResult<T>> {
  if (FAKE) return fake<T>(method, path, body);
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

// ───────── local fake: an "events" custom object with one record, enough to click through every state ─────────
type Rec = { id: string; createdAt: string; updatedAt: string; properties: Record<string, string | null> };
const g = globalThis as unknown as { __hsFake?: Map<string, Rec> };
function store() {
  if (!g.__hsFake) {
    g.__hsFake = new Map();
    const now = new Date().toISOString();
    g.__hsFake.set('900000000001', { id: '900000000001', createdAt: now, updatedAt: now, properties: { event_name: 'Bitcoin Amsterdam', event_location: 'Amsterdam', event_start_date: null, event_end_date: null } });
  }
  return g.__hsFake;
}
async function fake<T>(method: Method, path: string, body?: unknown): Promise<HsResult<T>> {
  const ok = (data: unknown, status = 200): HsResult<T> => ({ ok: true, status, data: data as T });
  const s = store(), b = (body || {}) as { properties?: Record<string, string> };
  if (path.startsWith('/account-info/v3/details')) return ok({ portalId: 1, uiDomain: 'app-eu1.hubspot.com', timeZone: 'Europe/Vienna' });
  if (path.startsWith('/crm/v3/schemas')) return ok({ results: [{ name: 'events', objectTypeId: '2-1', labels: { plural: 'Events' } }] });
  let m = path.match(/^\/crm\/v3\/objects\/2-1\?/);
  if (m && method === 'GET') return ok({ results: [...s.values()] });
  m = path.match(/^\/crm\/v3\/objects\/2-1\/(\d+)/);
  if (m && method === 'GET') { const r = s.get(m[1]); return r ? ok(r) : { ok: false, status: 404, error: 'Object not found' }; }
  if (m && method === 'PATCH') { const r = s.get(m[1]); if (!r) return { ok: false, status: 404, error: 'Object not found' }; r.properties = { ...r.properties, ...b.properties }; r.updatedAt = new Date().toISOString(); return ok(r); }
  if (path === '/crm/v3/objects/2-1' && method === 'POST') {
    const id = String(900000000000 + s.size + 1), now = new Date().toISOString();
    const r = { id, createdAt: now, updatedAt: now, properties: { ...b.properties } }; s.set(id, r); return ok(r, 201);
  }
  return { ok: false, status: 404, error: 'fake: ' + method + ' ' + path };
}
