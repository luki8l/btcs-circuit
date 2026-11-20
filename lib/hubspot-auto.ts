// Automatic HubSpot sync after Roman's actions. Off unless HUBSPOT_AUTO_SYNC=on (set after the manual test).
//   approval / "send someone"  → the event gets a HubSpot record (an exact existing one is linked, not duplicated)
//   editing a linked event     → its HubSpot record is updated
// Runs after the response (the approval never waits for HubSpot); failures are logged and can be fixed by hand.
import type { Rpc } from './rpc';
import type { Data, RawEvent } from './model';
import { findCandidates, createRecord, updateRecord } from './hubspot-event';

export async function autoSync(fn: string, args: Record<string, unknown>, result: unknown, rpc: Rpc) {
  const data = await rpc<Data>('bootstrap');
  const byId = new Map(data.events.map(e => [e.id, e]));
  const link = (e: RawEvent, id: string, what: 'created' | 'linked' | 'updated') => rpc('event_hubspot_link', { p_id: e.id, p_hubspot_id: id, p_action: what });

  if (fn === 'event_save') {
    const e = byId.get((result as { id?: number })?.id ?? -1);
    if (e?.hubspotId) { const r = await updateRecord(e.hubspotId, e); if (r.ok) await link(e, e.hubspotId, 'updated'); else console.error('hubspot auto update', e.id, r.error); }
    return;
  }
  let ids: number[] = [];
  if (fn === 'request_decide' && args.p_status === 'approved') {
    const want = new Set(args.p_ids as string[]);
    ids = data.requests.filter(r => want.has(r.id) && r.status === 'approved').map(r => r.eventId);
  }
  if (fn === 'request_assign') ids = [Number(args.p_event)];
  for (const id of new Set(ids)) {
    const e = byId.get(id);
    if (!e || e.hubspotId) continue;
    const { list, error } = await findCandidates(e);
    if (error) { console.error('hubspot auto find', id, error); continue; }
    const linked = new Set(data.events.map(x => x.hubspotId).filter(Boolean));
    const twin = list.find(c => c.exact && !linked.has(c.id));
    if (twin) { await link(e, twin.id, 'linked'); continue; }
    const r = await createRecord(e);
    if (r.ok) await link(e, r.data!.id, 'created'); else console.error('hubspot auto create', id, r.error);
  }
}
