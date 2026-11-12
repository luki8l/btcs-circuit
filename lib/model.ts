// Shared types and pure helpers (client and server). No secrets, no I/O.

export type Role = 'admin' | 'events' | 'management' | 'sales';
export type Person = { id: string; name: string; initials: string; role: Role; market: string; team: string; title: string; active: boolean; email?: string };
export type RawEvent = {
  id: number; name: string; website: string | null; start: string | null; end: string | null; mode: 'exact' | 'month' | 'tbd'; dateNote: string | null;
  region: string; country: string; city: string | null; kind: string | null; focus: string | null; tier: number | null; tierPrev: number | null;
  ratingAvg: number | null; ratingSd: number | null; ratingMedian: number | null; ratingN: number; ratingDist: number[]; fit: (number | null)[];
  audience: string | null; size: string | null; costTicket: string | null; costSponsor: string | null; notes: string | null; history: string | null;
  comment: string | null; isNew: boolean; source: 'masterlist' | 'suggestion' | 'manual'; archived: boolean; updatedAt: string;
};
export type Status = 'requested' | 'approved' | 'declined' | 'withdrawn';
export type Mode = 'attend' | 'speak' | 'meetings' | 'sponsor';
export type Ticket = 'free' | 'paid' | 'have';
export type Req = {
  id: string; eventId: number; personId: string; status: Status; mode: Mode; ticket: Ticket; cost: number; groups: number[]; meetingsPlanned: number;
  reason: string; decisionNote: string; decidedBy: string | null; decidedAt: string | null; hubspot: boolean; leads: number | null; meetingsHeld: number | null;
  rating: number | null; goAgain: 'yes' | 'maybe' | 'no' | null; debriefNote: string; debriefedAt: string | null; createdBy: string | null; createdAt: string; updatedAt: string;
};
export type Flag = { eventId: number; note: string; by: string | null; at: string };
export type Suggestion = { id: string; name: string; month: string | null; city: string; website: string; reason: string; source: 'app' | 'masterlist'; by: string | null; status: 'pending' | 'added' | 'dismissed'; eventId: number | null; createdAt: string };
export type Data = { me: Person & { email: string }; today: string; people: Person[]; events: RawEvent[]; requests: Req[]; flags: Flag[]; suggestions: Suggestion[] };

export type Ev = RawEvent & {
  sd: Date | null; ed: Date | null; endCheck: Date | null; past: boolean; mk: string; tk: number;
  group: 'digital' | 'tradfi' | 'other'; reg: string; hay: string;
};

// ───────────────────────────── vocabulary ─────────────────────────────
export const GROUPS = ['Crypto HNWIs & founders', 'TradFi HNWI / UHNWI', 'Family offices & EAMs', 'Crypto treasury companies', 'Funds (crypto & curious)'];
export const GS = ['Crypto HNWI', 'TradFi HNWI', 'FO / EAM', 'Treasury cos', 'Funds'];
export const MODES: Record<Mode, [string, string]> = {
  attend: ['Attend & work the floor', 'Ticket, meetings, networking'],
  speak: ['Speaker or panel', 'Stage slot for Bitcoin Suisse'],
  meetings: ['Side meetings only', 'No ticket, meetings around it'],
  sponsor: ['Propose a sponsorship', 'Booth, dinner or partner package'],
};
export const TICKETS: Record<Ticket, [string, string]> = {
  free: ['Free ticket', 'Guest, speaker or partner pass'],
  paid: ['Paid ticket', 'Needs marketing budget'],
  have: ['Already covered', 'I have a ticket or invite'],
};
export const POLICY: Record<number, [string, string]> = {
  1: ['Stage presence', 'Selection logic: Andrej on stage when reach and cost are medium to high, otherwise someone else from Bitcoin Suisse on stage.'],
  2: ['Stage presence', 'Selection logic: someone from Bitcoin Suisse on stage, cost low to zero.'],
  3: ['Work the floor', 'Selection logic: RMs get tickets and work the floor.'],
  4: ["Don't go", "Selection logic: don't go. A request needs a reason for an exception."],
  5: ["Don't go", "Selection logic: don't go. A request needs a reason for an exception."],
  0: ['Not rated yet', 'Not part of the 2027 rating round yet.'],
};
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', events: 'Events', management: 'Management', sales: 'Sales' };
export const ROLE_HINT: Record<Role, string> = {
  admin: 'Everything, plus accounts',
  events: 'Approves requests, keeps the catalogue',
  management: 'Sees everything, read-only',
  sales: 'Requests events, debriefs',
};
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SIZE_R: Record<string, number> = { 'XS': 3.4, 'XS/S': 3.8, 'S': 4.2, 'S/M': 4.8, 'M': 5.4, 'M/L': 6, 'L': 6.6, 'L/XL': 7.3, 'XL': 8, 'XXL': 9.6 };
export const REGIONS = ['EU', 'CH', 'ME', 'US', 'APAC', 'Other'];
export const REGION_LABEL: Record<string, string> = { EU: 'Europe', CH: 'Switzerland', ME: 'Middle East', US: 'Americas', APAC: 'Asia-Pacific', Other: 'Other' };
export const KINDS: Record<string, string> = { digital: 'Digital assets', tradfi: 'TradFi & wealth', other: 'Other' };
export const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const ML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const isStaff = (r: Role) => r === 'admin' || r === 'events';
export const canSeeInsights = (r: Role) => r !== 'sales';

// ───────────────────────────── dates ─────────────────────────────
export const pd = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const mIdx = (d: Date) => d.getFullYear() * 12 + d.getMonth();
export const dim = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthKey = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const monthLabel = (i: number, long = false) => `${(long ? ML : MS)[i % 12]} ${Math.floor(i / 12)}`;
export const keyToIdx = (k: string) => { const [y, m] = k.split('-').map(Number); return y * 12 + m - 1; };

export function kindOf(t: string | null): Ev['group'] {
  const s = (t || '').toLowerCase();
  if (/crypto|bitcoin|ethereum|polkadot|solana|cardano|near|rwa|stablecoin|token|web3|blockchain|digital asset|defi|dao/.test(s)) return 'digital';
  if (/tradfi|family|wealth|invest|treasury|macro|alternative|private|fund|pension|financ|bank|asset|capital|policy|universal/.test(s)) return 'tradfi';
  return 'other';
}

export function prep(e: RawEvent, today: Date): Ev {
  const sd = e.start ? pd(e.start) : null;
  let ed = e.end ? pd(e.end) : sd;
  if (sd && ed && ed < sd) ed = sd;
  const endCheck = e.mode === 'tbd' || !sd ? null : e.mode === 'month' ? new Date(sd.getFullYear(), sd.getMonth() + 1, 0) : ed;
  return {
    ...e, sd, ed, endCheck, past: !!endCheck && endCheck < today, mk: e.mode === 'tbd' || !e.start ? 'TBD' : e.start.slice(0, 7),
    tk: e.tier || 0, group: kindOf(e.kind), reg: REGIONS.includes(e.region) ? e.region : 'Other',
    hay: [e.name, e.city, e.country, e.region, e.kind, e.focus].join(' ').toLowerCase(),
  };
}

export function dateLabel(e: Ev): string {
  if (e.mode === 'tbd' || !e.sd) return 'Date TBD';
  const s = e.sd, t = e.ed || s;
  if (e.mode === 'month') return `${MS[s.getMonth()]} ${s.getFullYear()} · ${e.dateNote || 'day TBC'}`;
  if (+s === +t) return `${s.getDate()} ${MS[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getMonth() === t.getMonth() && s.getFullYear() === t.getFullYear()) return `${s.getDate()}–${t.getDate()} ${MS[s.getMonth()]} ${s.getFullYear()}`;
  return `${s.getDate()} ${MS[s.getMonth()]} – ${t.getDate()} ${MS[t.getMonth()]} ${t.getFullYear()}`;
}
export const place = (e: RawEvent) => [e.city, e.country && e.country !== 'TBA' && e.country !== e.city ? e.country : null].filter(Boolean).join(', ') || 'Location TBA';
export const chf = (n: number) => 'CHF ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '’');
export const bestFit = (e: RawEvent) => { const m = Math.max(...e.fit.map(v => v || 0)); return m ? `${GS.filter((_, i) => e.fit[i] === m).join(', ')} (${m}/5)` : 'not rated'; };

// ───────────────────────────── filters ─────────────────────────────
export type Presence = 'going' | 'requested' | 'open' | 'flagged' | 'mine';
export type Filters = {
  q: string; when: 'upcoming' | 'all' | 'past'; from: string; to: string;
  tiers: number[]; regions: string[]; countries: string[]; kinds: string[]; sizes: string[]; presence: Presence[];
  fitGroup: number; fitMin: number;
};
export const NO_FILTERS: Filters = { q: '', when: 'upcoming', from: '', to: '', tiers: [], regions: [], countries: [], kinds: [], sizes: [], presence: [], fitGroup: -1, fitMin: 0 };
export const sizeBucket = (s: string | null) => { if (!s) return ''; const b = s.split('/')[0].trim().toUpperCase(); return SIZES.includes(b) ? b : ''; };

export type PresenceInfo = { approved: Req[]; requested: Req[]; flagged: boolean; mine: boolean };
export function matches(e: Ev, f: Filters, p: PresenceInfo, skip?: keyof Filters): boolean {
  if (skip !== 'when') { if (f.when === 'upcoming' && e.past) return false; if (f.when === 'past' && !e.past) return false; }
  if (skip !== 'from' && f.from && (e.mk === 'TBD' || e.mk < f.from)) return false;
  if (skip !== 'to' && f.to && (e.mk === 'TBD' || e.mk > f.to)) return false;
  if (skip !== 'q' && f.q) { const qs = f.q.toLowerCase().split(/\s+/).filter(Boolean); if (!qs.every(q => e.hay.includes(q))) return false; }
  if (skip !== 'tiers' && f.tiers.length && !f.tiers.includes(e.tk)) return false;
  if (skip !== 'regions' && f.regions.length && !f.regions.includes(e.reg)) return false;
  if (skip !== 'countries' && f.countries.length && !f.countries.includes(e.country)) return false;
  if (skip !== 'kinds' && f.kinds.length && !f.kinds.includes(e.group)) return false;
  if (skip !== 'sizes' && f.sizes.length && !f.sizes.includes(sizeBucket(e.size))) return false;
  if (skip !== 'fitGroup' && f.fitGroup >= 0 && f.fitMin > 0 && !((e.fit[f.fitGroup] || 0) >= f.fitMin)) return false;
  if (skip !== 'presence' && f.presence.length) {
    const hit = f.presence.some(x => x === 'going' ? p.approved.length > 0 : x === 'requested' ? p.requested.length > 0
      : x === 'open' ? p.approved.length + p.requested.length === 0 : x === 'flagged' ? p.flagged : p.mine);
    if (!hit) return false;
  }
  return true;
}
export function filtersToQuery(f: Filters): string {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.when !== 'upcoming') q.set('when', f.when);
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  for (const k of ['tiers', 'regions', 'countries', 'kinds', 'sizes', 'presence'] as const) if (f[k].length) q.set(k, (f[k] as (string | number)[]).join(','));
  if (f.fitGroup >= 0 && f.fitMin > 0) q.set('fit', `${f.fitGroup}:${f.fitMin}`);
  return q.toString();
}
export function queryToFilters(q: URLSearchParams): Filters {
  const list = (k: string) => (q.get(k) || '').split(',').map(s => s.trim()).filter(Boolean);
  const [g, m] = (q.get('fit') || '').split(':').map(Number);
  const w = q.get('when');
  return {
    q: q.get('q') || '', when: w === 'all' || w === 'past' ? w : 'upcoming', from: /^\d{4}-\d{2}$/.test(q.get('from') || '') ? q.get('from')! : '', to: /^\d{4}-\d{2}$/.test(q.get('to') || '') ? q.get('to')! : '',
    tiers: list('tiers').map(Number).filter(n => n >= 0 && n <= 5), regions: list('regions'), countries: list('countries'), kinds: list('kinds'), sizes: list('sizes'),
    presence: list('presence').filter(x => ['going', 'requested', 'open', 'flagged', 'mine'].includes(x)) as Presence[],
    fitGroup: Number.isInteger(g) && g >= 0 && g <= 4 ? g : -1, fitMin: Number.isInteger(m) && m >= 1 && m <= 5 ? m : 0,
  };
}
