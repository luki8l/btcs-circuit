// Admin only, read only: what the HubSpot service key can see, to plan the Circuit ↔ HubSpot connection.
// Returns access per area, the account's basics, existing marketing events and campaigns (names, dates, counts),
// event/lead-related fields on contacts and deals, deal pipelines, and which Circuit people have a HubSpot owner.
// No contact or deal records are returned, only whether they can be read.
import { NextResponse } from 'next/server';
import { rpcClient, statusOf, messageOf } from '@/lib/rpc';
import { hsGet, hsScopes, hubspotConfigured, type HsResult } from '@/lib/hubspot';
import type { Data } from '@/lib/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Prop = { name: string; label: string; type: string; fieldType: string; groupName: string; hubspotDefined?: boolean; options?: { label: string }[] };
const RELEVANT = /event|lead|source|conference|messe|campaign|webinar|attend|origin/i;
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').toLowerCase().trim();
const access = (r: HsResult) => r.ok ? 'ok' : { status: r.status, error: r.error, missingScopes: r.missingScopes };
const props = (r: HsResult<{ results: Prop[] }>) => r.ok ? r.data!.results
  .filter(p => RELEVANT.test(p.name) || RELEVANT.test(p.label) || RELEVANT.test(p.groupName))
  .map(p => ({ name: p.name, label: p.label, type: p.fieldType, custom: !p.hubspotDefined, options: p.options?.slice(0, 25).map(o => o.label) })) : access(r);

export async function GET() {
  let data: Data;
  try { data = await (await rpcClient())<Data>('bootstrap'); }
  catch (e) { return NextResponse.json({ error: messageOf(e) }, { status: statusOf(e) }); }
  if (data.me.role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  if (!hubspotConfigured()) return NextResponse.json({ connected: false, error: 'HUBSPOT_SERVICE_KEY is not set in Vercel (or the app was not redeployed since).' }, { status: 503 });

  const [scopes, schemas, account, events, eventsV3, campaigns, contacts, contactProps, deals, dealProps, pipelines, owners] = await Promise.all([
    hsScopes(),
    hsGet<{ results: { name: string; objectTypeId: string; labels?: { singular?: string; plural?: string }; properties?: { name: string; label: string; type: string; hubspotDefined?: boolean }[] }[] }>('/crm/v3/schemas'),
    hsGet<Record<string, unknown>>('/account-info/v3/details'),
    hsGet<{ results?: Record<string, unknown>[]; total?: number }>('/marketing/marketing-events/2026-09?limit=100'),
    hsGet<{ results?: Record<string, unknown>[]; total?: number }>('/marketing/v3/marketing-events?limit=100'),
    hsGet<{ results?: Record<string, unknown>[]; total?: number }>('/marketing/v3/campaigns?limit=50&properties=hs_name,hs_start_date,hs_end_date'),
    hsGet('/crm/v3/objects/contacts?limit=1'),
    hsGet<{ results: Prop[] }>('/crm/v3/properties/contacts'),
    hsGet('/crm/v3/objects/deals?limit=1'),
    hsGet<{ results: Prop[] }>('/crm/v3/properties/deals'),
    hsGet<{ results: { label: string; stages: { label: string }[] }[] }>('/crm/v3/pipelines/deals'),
    hsGet<{ results: { firstName?: string; lastName?: string; archived?: boolean }[] }>('/crm/v3/owners?limit=500'),
  ]);

  // the custom "Events" object (if any): its rules and the records already in it
  type Schema = { name: string; objectTypeId: string; requiredProperties?: string[]; primaryDisplayProperty?: string; associatedObjects?: string[];
                  properties?: { name: string; label: string; type: string; hubspotDefined?: boolean; options?: { label: string; value: string }[] }[] };
  const evObj = schemas.ok ? schemas.data!.results.find(o => /event/i.test(o.name)) : undefined;
  const [evSchema, evRecords] = evObj ? await Promise.all([
    hsGet<Schema>(`/crm/v3/schemas/${evObj.objectTypeId}`),
    hsGet<{ total?: number; results: { id: string; createdAt: string; properties: Record<string, string | null> }[] }>(`/crm/v3/objects/${evObj.objectTypeId}?limit=100&properties=event_name,event_location,event_start_date,event_end_date,event_type,event_format,event_audience,hs_created_by_user_id`),
  ]) : [null, null];
  const ev = events.ok ? events : eventsV3;
  const evList = ev.ok ? (ev.data?.results || []) : [];
  const ownerNames = new Set(owners.ok ? owners.data!.results.map(o => fold(`${o.firstName || ''} ${o.lastName || ''}`)) : []);
  const circuitPeople = data.people.filter(p => p.active && (p.role === 'sales' || p.role === 'events'));

  return NextResponse.json({
    connected: true,
    checkedAt: new Date().toISOString(),
    scopes: scopes.ok ? (scopes.data?.scopes || []).slice().sort() : access(scopes),
    customObjects: schemas.ok ? schemas.data!.results.map(o => ({ name: o.name, id: o.objectTypeId, label: o.labels?.plural || o.labels?.singular, fields: (o.properties || []).filter(p => !p.hubspotDefined).map(p => `${p.label} (${p.name}, ${p.type})`) })) : access(schemas),
    access: {
      accountInfo: access(account), marketingEvents: access(events), marketingEventsV3: access(eventsV3), campaigns: access(campaigns),
      contactsRead: access(contacts), contactProperties: access(contactProps), dealsRead: access(deals), dealProperties: access(dealProps),
      dealPipelines: access(pipelines), owners: access(owners),
    },
    eventsObject: evObj ? {
      id: evObj.objectTypeId,
      schema: evSchema?.ok ? {
        required: evSchema.data!.requiredProperties, display: evSchema.data!.primaryDisplayProperty, associatedWith: evSchema.data!.associatedObjects,
        choices: Object.fromEntries((evSchema.data!.properties || []).filter(p => !p.hubspotDefined && p.options?.length).map(p => [p.name, p.options!.map(o => `${o.label} = ${o.value}`)])),
      } : evSchema && access(evSchema),
      records: evRecords?.ok ? { count: evRecords.data!.results.length, more: !!(evRecords.data as { paging?: unknown }).paging, items: evRecords.data!.results.map(r => ({ id: r.id, created: r.createdAt, ...r.properties })) } : evRecords && access(evRecords),
    } : null,
    account: account.ok ? Object.fromEntries(['portalId', 'accountType', 'timeZone', 'companyCurrency', 'dataHostingLocation', 'uiDomain'].map(k => [k, account.data![k]])) : null,
    marketingEvents: ev.ok ? {
      endpoint: events.ok ? '2026-09' : 'v3', total: ev.data?.total ?? evList.length,
      sample: evList.slice(0, 40).map(e => ({
        name: e.eventName, type: e.eventType, start: e.startDateTime, organizer: e.eventOrganizer, cancelled: e.eventCancelled,
        createdBy: (e.appInfo as { name?: string } | undefined)?.name || null, registrants: e.registrants, attendees: e.attendees,
      })),
    } : null,
    campaigns: campaigns.ok ? { total: campaigns.data?.total ?? campaigns.data?.results?.length, names: (campaigns.data?.results || []).slice(0, 50).map(c => (c.properties as Record<string, unknown> | undefined)?.hs_name ?? null) } : null,
    contactFields: props(contactProps),
    dealFields: props(dealProps),
    dealPipelines: pipelines.ok ? pipelines.data!.results.map(p => ({ pipeline: p.label, stages: p.stages.map(s => s.label) })) : null,
    owners: owners.ok ? {
      total: owners.data!.results.length,
      circuitPeopleWithOwner: circuitPeople.filter(p => ownerNames.has(fold(p.name))).map(p => p.name),
      circuitPeopleWithoutOwner: circuitPeople.filter(p => !ownerNames.has(fold(p.name))).map(p => p.name),
    } : null,
  }, { headers: { 'cache-control': 'no-store' } });
}
