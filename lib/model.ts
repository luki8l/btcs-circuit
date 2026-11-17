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
  group: 'digital' | 'tradfi' | 'other'; reg: string; hay: string; cn: string;
};

// ───────────────────────────── vocabulary ─────────────────────────────
export const GROUPS = ['Crypto HNWIs & founders', 'TradFi HNWI / UHNWI', 'Family offices & EAMs', 'Crypto treasury companies', 'Funds (crypto & curious)'];
export const GS = ['Crypto HNWI', 'TradFi HNWI', 'FO / EAM', 'Treasury cos', 'Funds'];
export const MODES: Record<Mode, [string, string]> = {
  attend: ['Attend', 'Ticket, meetings, networking'],
  speak: ['Speak or panel', 'A stage slot for Bitcoin Suisse'],
  meetings: ['Meetings only', 'No ticket, meetings around it'],
  sponsor: ['Sponsor', 'Booth, dinner or partner package'],
};
export const TICKETS: Record<Ticket, [string, string]> = {
  free: ['Free', 'Guest, speaker or partner pass'],
  paid: ['Paid', 'Needs budget'],
  have: ['I have one', 'Ticket or invite already there'],
};
export const POLICY: Record<number, [string, string]> = {
  1: ['Key event', 'Bitcoin Suisse should be on stage. Andrej speaks when reach and cost are medium to high, otherwise someone else from the team.'],
  2: ['Important', 'Someone from Bitcoin Suisse on stage; cost should be low to zero.'],
  3: ['Worth going', 'Relationship managers get tickets and work the floor.'],
  4: ['Low priority', "Usually we don't go. Requests need a short reason."],
  5: ['Skip', "We don't go. Requests need a short reason."],
  0: ['Not rated yet', 'Not part of the 2027 rating round yet.'],
};
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', events: 'Approver', management: 'Read-only', sales: 'Sales' };
export const ROLE_HINT: Record<Role, string> = {
  admin: 'Everything, plus accounts',
  events: 'Approves requests, flags events, keeps the catalogue (Roman)',
  management: 'Sees everything, changes nothing',
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

// ───────────────────────────── places ─────────────────────────────
// The masterlist mixes 2- and 3-letter codes (SE and SWE, UAE, SGP, TK for Türkiye, FL for Liechtenstein…).
// Everyone sees full country names; search also knows local names and the areas the teams think in.
const CC: Record<string, string> = {
  AR: 'Argentina', AT: 'Austria', BE: 'Belgium', BM: 'Bermuda', CA: 'Canada', CAN: 'Canada', CH: 'Switzerland', CZ: 'Czechia', DE: 'Germany',
  'DE/AT': 'Germany / Austria', DK: 'Denmark', ES: 'Spain', FI: 'Finland', FIN: 'Finland', FL: 'Liechtenstein', LI: 'Liechtenstein', FR: 'France',
  GB: 'United Kingdom', UK: 'United Kingdom', 'UNITED KINGDOM': 'United Kingdom', HK: 'Hong Kong', HR: 'Croatia', IE: 'Ireland', IN: 'India', IND: 'India',
  IT: 'Italy', JP: 'Japan', JAP: 'Japan', KR: 'South Korea', SK: 'South Korea', LU: 'Luxembourg', MC: 'Monaco', MX: 'Mexico', MEX: 'Mexico',
  NL: 'Netherlands', NO: 'Norway', HU: 'Hungary', BG: 'Bulgaria', RS: 'Serbia', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', QAT: 'Qatar', RO: 'Romania', SA: 'Saudi Arabia',
  SE: 'Sweden', SWE: 'Sweden', SG: 'Singapore', SGP: 'Singapore', SI: 'Slovenia', TH: 'Thailand', TR: 'Türkiye', TK: 'Türkiye',
  AE: 'United Arab Emirates', UAE: 'United Arab Emirates', US: 'United States', USA: 'United States', ZA: 'South Africa', ZAF: 'South Africa',
};
/** full country name for a masterlist code ('' when unknown yet) */
export const countryName = (c: string | null | undefined) => { const k = (c || '').trim(); if (!k || /^tba$/i.test(k)) return ''; return CC[k.toUpperCase()] || k; };
// areas the sales teams work in (used for search words and the "In the Nordics" quick filter)
export const AREAS: Record<string, string[]> = {
  'the Nordics': ['Sweden', 'Norway', 'Finland', 'Denmark', 'Iceland'],
  Benelux: ['Netherlands', 'Belgium', 'Luxembourg'],
  DACH: ['Germany', 'Austria', 'Switzerland', 'Liechtenstein', 'Germany / Austria'],
  'the Middle East': ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Oman', 'Kuwait'],
  'Austria & Eastern Europe': ['Austria', 'Germany / Austria', 'Czechia', 'Poland', 'Hungary', 'Slovakia', 'Slovenia', 'Croatia', 'Romania', 'Bulgaria', 'Serbia'],
};
// words a country's events are also found by (areas overlap, so this is per country, not per area)
const AREA_WORDS: [string[], string][] = [
  [AREAS['the Nordics'], 'nordics nordic scandinavia'], [AREAS.Benelux, 'benelux'], [AREAS['the Middle East'], 'middle east gcc'],
  [['Czechia', 'Poland', 'Hungary', 'Slovakia', 'Slovenia', 'Croatia', 'Romania', 'Bulgaria', 'Serbia'], 'eastern europe cee'],
];
export const areaOf = (country: string) => Object.keys(AREAS).find(a => AREAS[a].includes(country)) || '';
// extra words people type: local names, short forms
const ALIAS: Record<string, string> = {
  Austria: 'österreich osterreich', Germany: 'deutschland', 'Germany / Austria': 'deutschland österreich austria germany', Switzerland: 'schweiz suisse svizzera',
  Netherlands: 'holland nederland dutch', Belgium: 'belgië belgique belgien', Luxembourg: 'luxemburg', Sweden: 'sverige schweden', Norway: 'norge norwegen',
  Finland: 'suomi finnland', Denmark: 'danmark dänemark', 'United Kingdom': 'uk england britain great britain gb', 'United States': 'usa us america',
  'United Arab Emirates': 'uae emirates vae', Türkiye: 'turkey türkei turkiye', 'South Korea': 'korea', Spain: 'españa spanien', Italy: 'italia italien',
  France: 'frankreich', Czechia: 'czech republic tschechien', Portugal: 'portugal', 'Saudi Arabia': 'ksa saudi', Croatia: 'kroatien hrvatska',
  Liechtenstein: 'fl', 'Hong Kong': 'hk', Singapore: 'sg',
};
const CITY_ALIAS: [RegExp, string][] = [
  [/vienna/i, 'wien'], [/zurich/i, 'zürich zuerich'], [/geneva/i, 'genf genève geneve'], [/munich/i, 'münchen muenchen'], [/lucerne/i, 'luzern'],
  [/prague/i, 'prag praha'], [/milan/i, 'mailand milano'], [/lisbon/i, 'lissabon lisboa'], [/brussels/i, 'brüssel bruxelles'], [/cologne/i, 'köln'],
  [/copenhagen/i, 'kopenhagen københavn'], [/rome/i, 'rom roma'], [/warsaw/i, 'warschau'], [/hague/i, 'den haag'], [/basel/i, 'bâle'], [/bern/i, 'berne'],
];
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** lower-case, accents removed: "Zürich" and "zurich" match */
export const searchWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);

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
  const cn = countryName(e.country), area = AREA_WORDS.filter(([cs]) => cs.includes(cn)).map(([, w]) => w).join(' ');
  let ed = e.end ? pd(e.end) : sd;
  if (sd && ed && ed < sd) ed = sd;
  const endCheck = e.mode === 'tbd' || !sd ? null : e.mode === 'month' ? new Date(sd.getFullYear(), sd.getMonth() + 1, 0) : ed;
  return {
    ...e, sd, ed, endCheck, past: !!endCheck && endCheck < today, mk: e.mode === 'tbd' || !e.start ? 'TBD' : e.start.slice(0, 7),
    tk: e.tier || 0, group: kindOf(e.kind), reg: REGIONS.includes(e.region) ? e.region : 'Other',
    hay: fold([e.name, e.city, e.country, cn, ALIAS[cn], area, REGION_LABEL[e.region], e.kind, e.focus,
      ...CITY_ALIAS.filter(([re]) => re.test(e.city || '')).map(([, a]) => a)].filter(Boolean).join(' ')),
    cn,
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
export const place = (e: RawEvent) => {
  const c = countryName(e.country), city = e.city && !/^tba\b/i.test(e.city) ? e.city : '';
  return [city, c && fold(c) !== fold(city) ? c : null].filter(Boolean).join(', ') || 'Location TBA';
};
export const monthText = (ym: string | null) => { if (!ym || !/^\d{4}-\d{2}/.test(ym)) return ym || ''; return `${MS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`; };
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
  if (skip !== 'q' && f.q) { const qs = searchWords(f.q); if (!qs.every(q => e.hay.includes(q))) return false; }
  if (skip !== 'tiers' && f.tiers.length && !f.tiers.includes(e.tk)) return false;
  if (skip !== 'regions' && f.regions.length && !f.regions.includes(e.reg)) return false;
  if (skip !== 'countries' && f.countries.length && !f.countries.includes(e.cn)) return false;
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
