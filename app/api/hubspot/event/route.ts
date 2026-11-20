// One Circuit event ↔ its record in HubSpot's "Events" object. Roman and admins only.
//   preview  read only: what would go over, the linked record or look-alikes already in HubSpot
//   create   new record in HubSpot (refused when an exact look-alike exists, unless force)
//   link     connect to an existing record (nothing is written to HubSpot)
//   update   overwrite the record's four fields with Circuit's values
//   unlink   forget the connection (the record in HubSpot stays)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpcClient, statusOf, messageOf } from '@/lib/rpc';
import { sameOrigin } from '@/lib/origin';
import { hubspotConfigured } from '@/lib/hubspot';
import { hubspotPlan, findCandidates, getRecord, createRecord, updateRecord, autoSyncOn, HS_PROPS, HS_LABEL } from '@/lib/hubspot-event';
import { isStaff, type Data, type RawEvent } from '@/lib/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  eventId: z.number().int().positive(),
  action: z.enum(['preview', 'create', 'link', 'update', 'unlink']),
  hubspotId: z.string().regex(/^\d{1,30}$/).optional(),
  force: z.boolean().optional(),
});
const fail = (error: string, status: number, extra?: object) => NextResponse.json({ error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('not allowed', 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Some input is not valid.', 400);
  const { eventId, action, hubspotId, force } = parsed.data;

  let data: Data, rpc: Awaited<ReturnType<typeof rpcClient>>;
  try { rpc = await rpcClient(); data = await rpc<Data>('bootstrap'); }
  catch (e) { return fail(messageOf(e), statusOf(e)); }
  if (!isStaff(data.me.role)) return fail('Only Roman and admins can send events to HubSpot.', 403);
  if (!hubspotConfigured()) return fail('HubSpot is not connected (no service key).', 503);
  const e = data.events.find(x => x.id === eventId);
  if (!e) return fail('This event is not in the catalogue (any more).', 404);

  const link = async (id: string | null, what: 'created' | 'linked' | 'updated' | 'unlinked') => rpc<RawEvent>('event_hubspot_link', { p_id: e.id, p_hubspot_id: id, p_action: what });
  const taken = (id: string) => data.events.find(x => x.hubspotId === id && x.id !== e.id)?.name;

  try {
    if (action === 'preview') {
      const plan = hubspotPlan(e);
      const fields = HS_PROPS.map(k => ({ key: k, label: HS_LABEL[k], value: plan.props[k] }));
      if (e.hubspotId) {
        const { rec, error } = await getRecord(e.hubspotId);
        if (error) return fail(error, 502);
        return NextResponse.json({ fields, tz: plan.tz, notes: plan.notes, linked: rec, linkedMissing: !rec, candidates: [], auto: autoSyncOn() }, { headers: { 'cache-control': 'no-store' } });
      }
      const { list, error } = await findCandidates(e);
      if (error) return fail(error, 502);
      return NextResponse.json({ fields, tz: plan.tz, notes: plan.notes, linked: null, candidates: list.map(c => ({ ...c, linkedTo: taken(c.id) || null })), auto: autoSyncOn() }, { headers: { 'cache-control': 'no-store' } });
    }

    if (action === 'create') {
      if (e.hubspotId) return fail('Already linked to a HubSpot event. Use “Update in HubSpot”.', 409);
      if (!force) {
        const { list, error } = await findCandidates(e);
        if (error) return fail(error, 502);
        const twin = list.find(c => c.exact && !taken(c.id));
        if (twin) return fail('HubSpot already has this event. Link it instead, or create a new one anyway.', 409, { candidate: twin });
      }
      const r = await createRecord(e);
      if (!r.ok) return fail(r.error || 'HubSpot did not accept the event.', r.status === 403 ? 403 : 502, { missingScopes: r.missingScopes });
      return NextResponse.json({ ok: true, record: r.data, event: await link(r.data!.id, 'created') });
    }

    if (action === 'link') {
      if (!hubspotId) return fail('Choose a HubSpot event.', 400);
      if (taken(hubspotId)) return fail(`That HubSpot event is already linked to “${taken(hubspotId)}”.`, 409);
      const { rec, error } = await getRecord(hubspotId);
      if (error) return fail(error, 502);
      if (!rec) return fail('That HubSpot event does not exist (any more).', 404);
      return NextResponse.json({ ok: true, record: rec, event: await link(hubspotId, 'linked') });
    }

    if (action === 'update') {
      if (!e.hubspotId) return fail('Not linked to HubSpot yet.', 409);
      const r = await updateRecord(e.hubspotId, e);
      if (!r.ok) return fail(r.status === 404 ? 'The linked HubSpot event no longer exists. Unlink it and create a new one.' : (r.error || 'HubSpot did not accept the change.'), r.status === 404 ? 404 : r.status === 403 ? 403 : 502, { missingScopes: r.missingScopes });
      return NextResponse.json({ ok: true, record: r.data, event: await link(e.hubspotId, 'updated') });
    }

    return NextResponse.json({ ok: true, event: await link(null, 'unlinked') });
  } catch (err) {
    console.error('hubspot event', err);
    return fail(messageOf(err), statusOf(err));
  }
}
