// One endpoint for every change: { fn, args } → the database function of the same name, as the signed-in user.
// Only the functions listed here can be called, each with validated input; the database checks roles and rules again.
import { NextResponse, after } from 'next/server';
import { sameOrigin } from '@/lib/origin';
import { hubspotConfigured } from '@/lib/hubspot';
import { autoSyncOn } from '@/lib/hubspot-event';
import { z } from 'zod';
import { rpcClient, statusOf, messageOf } from '@/lib/rpc';

const uuid = z.string().uuid();
const id = z.number().int().positive();
const text = (n: number) => z.string().max(n);
const link = z.string().trim().max(500).refine(v => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'must be a web link (https://…)');
const mode = z.enum(['attend', 'speak', 'meetings', 'sponsor']);
const ticket = z.enum(['free', 'paid', 'have']);
const groups = z.array(z.number().int().min(0).max(4)).min(1).max(5);
const reqFields = { p_mode: mode, p_ticket: ticket, p_cost: z.number().min(0).max(9_999_999), p_groups: groups, p_meetings: z.number().int().min(0).max(500), p_reason: text(2000) };
const eventData = z.object({
  name: z.string().trim().min(1).max(200), website: link.optional().nullable(), mode: z.enum(['exact', 'month', 'tbd']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')),
  dateNote: text(80).optional().nullable(), region: text(20).optional().nullable(), country: text(40).optional().nullable(), city: text(120).optional().nullable(),
  kind: text(120).optional().nullable(), focus: text(300).optional().nullable(), tier: z.number().int().min(1).max(5).nullable().optional(),
  audience: text(300).optional().nullable(), size: text(12).optional().nullable(), costTicket: text(300).optional().nullable(), costSponsor: text(400).optional().nullable(),
  notes: text(4000).optional().nullable(), fit: z.array(z.number().int().min(1).max(5).nullable()).length(5).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal('')), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal('')),
});

const FNS: Record<string, z.ZodTypeAny> = {
  request_create: z.object({ p_event: id, ...reqFields }),
  request_edit: z.object({ p_id: uuid, ...reqFields }),
  request_withdraw: z.object({ p_id: uuid }),
  request_decide: z.object({ p_ids: z.array(uuid).min(1).max(200), p_status: z.enum(['approved', 'declined']), p_note: text(1000) }),
  request_reopen: z.object({ p_id: uuid }),
  request_assign: z.object({ p_event: id, p_person: uuid, p_mode: mode, p_note: text(1000) }),
  request_hubspot: z.object({ p_id: uuid, p_done: z.boolean() }),
  request_debrief: z.object({ p_id: uuid, p_leads: z.number().int().min(0).max(100000), p_held: z.number().int().min(0).max(10000), p_rating: z.number().int().min(1).max(5), p_again: z.enum(['yes', 'maybe', 'no']), p_note: text(2000) }),
  flag_set: z.object({ p_event: id, p_on: z.boolean(), p_note: text(300) }),
  suggestion_create: z.object({ p_name: z.string().trim().min(1).max(200), p_month: z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/), p_city: text(120), p_website: link, p_reason: text(2000) }),
  suggestion_decide: z.object({ p_id: uuid, p_add: z.boolean() }),
  event_save: z.object({ p_id: id.nullable(), p_data: eventData }),
  event_archive: z.object({ p_id: id, p_archived: z.boolean() }),
  activity_feed: z.object({ p_limit: z.number().int().min(1).max(500) }),
};

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'not allowed' }, { status: 403 });
  let raw: unknown = null;
  try { raw = await req.json(); } catch { /* not JSON */ }
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as { fn?: unknown; args?: unknown } : {};
  const fn = typeof body.fn === 'string' ? body.fn : '';
  const schema = Object.hasOwn(FNS, fn) ? FNS[fn] : undefined;      // own keys only: no "constructor", "__proto__"…
  if (!schema) return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  const parsed = schema.safeParse(body.args ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Some input is not valid: ' + parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ') }, { status: 400 });
  try {
    const rpc = await rpcClient();
    const data = await rpc(fn, parsed.data as Record<string, unknown>);
    // HubSpot (only when switched on): approvals create the event there, edits of linked events update it
    if (autoSyncOn() && hubspotConfigured() && ['request_decide', 'request_assign', 'event_save'].includes(fn)) {
      after(async () => { try { const { autoSync } = await import('@/lib/hubspot-auto'); await autoSync(fn, parsed.data as Record<string, unknown>, data, rpc); } catch (e) { console.error('hubspot auto', e); } });
    }
    return NextResponse.json({ ok: true, data }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    const status = statusOf(e);
    if (status === 500) console.error(e);
    return NextResponse.json({ error: messageOf(e) }, { status });
  }
}
