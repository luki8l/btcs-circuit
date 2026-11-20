// Circuit event → HubSpot "Events" record (custom object): which fields go over, finding an existing record,
// creating, linking and updating. Server only. Fields: Event Name, Event Location, Event Start Date, Event End Date.
import { hs, hsGet, type HsResult } from './hubspot';
import { place, type RawEvent } from './model';
import { eventTz, zonedToUtc, tzLabel, dayIn } from './tz';

export const HS_PROPS = ['event_name', 'event_location', 'event_start_date', 'event_end_date'] as const;
export type HsProps = Record<(typeof HS_PROPS)[number], string>;
export type HsRecord = { id: string; url: string; props: Partial<Record<(typeof HS_PROPS)[number], string | null>>; updatedAt?: string };
export const HS_LABEL: Record<(typeof HS_PROPS)[number], string> = { event_name: 'Event Name', event_location: 'Event Location', event_start_date: 'Event Start Date', event_end_date: 'Event End Date' };

/** what Circuit would send for this event, plus plain-language notes (whole day, time zone, month only) */
export function hubspotPlan(e: RawEvent): { props: HsProps; tz: string; notes: string[] } {
  const loc = place(e) === 'Location TBA' ? '' : place(e);
  const { tz, guessed } = eventTz(e);
  const notes: string[] = [];
  let start = '', end = '';
  if (e.mode === 'exact' && e.start) {
    start = zonedToUtc(e.start, e.startTime || '00:00', tz).toISOString();
    end = zonedToUtc(e.end || e.start, e.endTime || '23:59', tz).toISOString();
    if (!e.startTime && !e.endTime) notes.push('No times in Circuit yet, so the whole day goes to HubSpot (00:00 to 23:59).');
    notes.push(`Times are ${tzLabel(tz)}${guessed ? ' (place unknown, so Vienna time is used)' : ''}.`);
  } else {
    notes.push(e.mode === 'month' ? 'Only the month is known: start and end stay empty in HubSpot until the days are set.' : 'Date TBD: start and end stay empty in HubSpot.');
  }
  if (!loc) notes.push('No location in Circuit yet.');
  return { props: { event_name: e.name.trim(), event_location: loc, event_start_date: start, event_end_date: end }, tz, notes };
}

// ───── HubSpot account details, looked up once per server instance ─────
let cache: { type: string; ui: string; portal: number } | null = null;
export async function hubspotTarget(): Promise<{ type: string; ui: string; portal: number } | { error: string; status: number }> {
  if (cache) return cache;
  const [schemas, acct] = await Promise.all([
    hsGet<{ results: { name: string; objectTypeId: string }[] }>('/crm/v3/schemas'),
    hsGet<{ portalId: number; uiDomain: string }>('/account-info/v3/details'),
  ]);
  if (!schemas.ok) return { error: 'HubSpot: ' + (schemas.error || 'no access to the custom objects'), status: 502 };
  const obj = process.env.HUBSPOT_EVENTS_OBJECT || schemas.data!.results.find(o => o.name === 'events')?.objectTypeId;
  if (!obj) return { error: 'HubSpot has no custom object called "events".', status: 502 };
  cache = { type: obj, ui: acct.ok ? acct.data!.uiDomain : 'app.hubspot.com', portal: acct.ok ? acct.data!.portalId : 0 };
  return cache;
}
const recUrl = (t: { type: string; ui: string; portal: number }, id: string) => `https://${t.ui}/contacts/${t.portal}/record/${t.type}/${id}`;
type Raw = { id: string; updatedAt?: string; properties: Record<string, string | null> };
const toRec = (t: { type: string; ui: string; portal: number }, r: Raw): HsRecord =>
  ({ id: r.id, url: recUrl(t, r.id), updatedAt: r.updatedAt, props: Object.fromEntries(HS_PROPS.map(k => [k, r.properties?.[k] ?? null])) });

const fold = (s: string | null | undefined) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function getRecord(id: string): Promise<{ rec: HsRecord | null; error?: string }> {
  const t = await hubspotTarget(); if ('error' in t) return { rec: null, error: t.error };
  const r = await hsGet<Raw>(`/crm/v3/objects/${t.type}/${id}?properties=${HS_PROPS.join(',')}`);
  if (r.ok) return { rec: toRec(t, r.data!) };
  return { rec: null, error: r.status === 404 ? undefined : 'HubSpot: ' + r.error };
}

/** existing HubSpot events that look like this one: same name (ignoring case and punctuation), or one name inside the
 *  other; with dates on both sides they must overlap. `exact` = same name and (no dates or same start day). Read only. */
export async function findCandidates(e: RawEvent): Promise<{ list: (HsRecord & { exact: boolean })[]; error?: string }> {
  const t = await hubspotTarget(); if ('error' in t) return { list: [], error: t.error };
  const all: Raw[] = [];
  let after = '';
  for (let i = 0; i < 10; i++) {   // up to 1,000 records
    const r = await hsGet<{ results: Raw[]; paging?: { next?: { after: string } } }>(`/crm/v3/objects/${t.type}?limit=100&properties=${HS_PROPS.join(',')}${after ? '&after=' + after : ''}`);
    if (!r.ok) return { list: [], error: 'HubSpot: ' + r.error };
    all.push(...r.data!.results);
    after = r.data!.paging?.next?.after || '';
    if (!after) break;
  }
  // days compared in the event's own time zone (HubSpot stores absolute times)
  const plan = hubspotPlan(e), n = fold(e.name), day = (iso: string | null | undefined) => dayIn(iso, plan.tz);
  const c0 = day(plan.props.event_start_date), c1 = day(plan.props.event_end_date) || c0;
  const list = all.filter(r => {
    const m = fold(r.properties.event_name);
    if (!m || !n) return false;
    const named = m === n || (n.length >= 6 && m.includes(n)) || (m.length >= 6 && n.includes(m));
    if (!named) return false;
    const hs0 = day(r.properties.event_start_date), hs1 = day(r.properties.event_end_date) || hs0;
    if (!hs0 || !c0) return true;
    return hs0 <= c1 && hs1 >= c0;
  }).map(r => ({ ...toRec(t, r), exact: fold(r.properties.event_name) === n && (!day(r.properties.event_start_date) || !c0 || day(r.properties.event_start_date) === c0) }));
  return { list };
}

/** create the record; empty fields are left out */
export async function createRecord(e: RawEvent): Promise<HsResult<HsRecord>> {
  const t = await hubspotTarget(); if ('error' in t) return { ok: false, status: t.status, error: t.error };
  const props = Object.fromEntries(Object.entries(hubspotPlan(e).props).filter(([, v]) => v));
  const r = await hs<Raw>('POST', `/crm/v3/objects/${t.type}`, { properties: props });
  return r.ok ? { ok: true, status: r.status, data: toRec(t, r.data!) } : { ok: false, status: r.status, error: 'HubSpot: ' + r.error, missingScopes: r.missingScopes };
}

/** overwrite the four fields with what Circuit has now (an empty field in Circuit empties it in HubSpot) */
export async function updateRecord(id: string, e: RawEvent): Promise<HsResult<HsRecord>> {
  const t = await hubspotTarget(); if ('error' in t) return { ok: false, status: t.status, error: t.error };
  const r = await hs<Raw>('PATCH', `/crm/v3/objects/${t.type}/${id}`, { properties: hubspotPlan(e).props });
  return r.ok ? { ok: true, status: r.status, data: toRec(t, r.data!) } : { ok: false, status: r.status, error: 'HubSpot: ' + r.error, missingScopes: r.missingScopes };
}

/** on/off switch for creating records automatically when Roman approves (off until the manual test is done) */
export const autoSyncOn = () => process.env.HUBSPOT_AUTO_SYNC === 'on';
