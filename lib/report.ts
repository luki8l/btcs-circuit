// The numbers behind the Overview, the Excel export and the PDF report: one place, so they always agree.
import { pd, prep, REGIONS, REGION_LABEL, type Data, type Ev, type Person, type Req } from './model';

export type Row = { r: Req; e: Ev; p: Person | undefined };
/** what a group of requests adds up to: trips ahead, waiting, events done, debriefs due, leads, rating, budget */
export type Tally = { ahead: number; waiting: number; went: number; due: number; leads: number; debriefs: number; perEvent: number | null; rating: number | null; spend: number };
export type PersonRow = Tally & { id: string; name: string; market: string; team: string; active: boolean; rows: Row[] };
export type TeamRow = Tally & { t: string; people: number; members: PersonRow[] };
export type Report = {
  today: Date;
  events: Ev[];
  ev: Map<number, Ev>;
  people: Map<string, Person>;
  /** requests that count: not withdrawn, event still in the list */
  rows: Row[];
  kpi: {
    upcoming: number; total: number; key: number; keyCovered: number; ahead: number; aheadEvents: number; waiting: number;
    budget: number; leads: number; debriefs: number; meetings: number; due: number; costPerLead: number | null;
  };
  teams: TeamRow[];
  /** every sales person (and anyone else who travels), best first */
  persons: PersonRow[];
  regions: { region: string; label: string; covered: number; total: number }[];
  /** approved and already started: the results table (debrief done or due) */
  results: Row[];
  /** approved, not started yet */
  trips: Row[];
  /** Tier 1–2 ahead, nobody approved or waiting */
  gaps: { e: Ev; flagged: boolean }[];
};

export function buildReport(data: Data, prepped?: Ev[]): Report {
  const today = pd(data.today);
  const events = prepped || data.events.map(e => prep(e, today));
  const ev = new Map(events.map(e => [e.id, e]));
  const people = new Map(data.people.map(p => [p.id, p]));
  const flagged = new Set(data.flags.map(f => f.eventId));
  const rows: Row[] = data.requests.filter(r => r.status !== 'withdrawn' && ev.has(r.eventId)).map(r => ({ r, e: ev.get(r.eventId)!, p: people.get(r.personId) }));
  const started = (e: Ev) => e.past || (!!e.sd && e.mode !== 'tbd' && e.sd <= today);
  const appr = rows.filter(x => x.r.status === 'approved');
  const approvedAt = new Set(appr.map(x => x.e.id)), askedAt = new Set(rows.filter(x => x.r.status === 'requested').map(x => x.e.id));
  const went = appr.filter(x => started(x.e)), deb = went.filter(x => x.r.rating);
  const trips = appr.filter(x => !started(x.e)).sort((a, b) => (a.e.sd ? +a.e.sd : 9e15) - (b.e.sd ? +b.e.sd : 9e15));
  const up = events.filter(e => !e.past);
  const key = up.filter(e => e.mode !== 'tbd' && (e.tk === 1 || e.tk === 2));
  const leads = deb.reduce((a, x) => a + (x.r.leads || 0), 0);
  const spendDeb = deb.reduce((a, x) => a + Number(x.r.cost || 0), 0);

  const teamOf = (pid: string) => people.get(pid)?.team || 'No team';
  const tally = (xs: Row[]): Tally => {
    const a = xs.filter(x => x.r.status === 'approved'), done = a.filter(x => started(x.e)), dd = done.filter(x => x.r.rating);
    const leads = dd.reduce((s, x) => s + (x.r.leads || 0), 0);
    return {
      ahead: a.filter(x => !started(x.e)).length, waiting: xs.filter(x => x.r.status === 'requested').length, went: done.length, due: done.length - dd.length,
      leads, debriefs: dd.length, perEvent: dd.length ? leads / dd.length : null,
      rating: dd.length ? dd.reduce((s, x) => s + (x.r.rating || 0), 0) / dd.length : null, spend: a.reduce((s, x) => s + Number(x.r.cost || 0), 0),
    };
  };
  const best = (x: Tally & { name?: string; t?: string }, y: Tally & { name?: string; t?: string }) => y.leads - x.leads || y.went - x.went || y.ahead - x.ahead || (x.name || x.t || '').localeCompare(y.name || y.t || '');
  // people: active sales always; anyone else (events team, management, former colleagues) when they have requests
  const ids = [...new Set([...data.people.filter(p => p.active && p.role === 'sales').map(p => p.id), ...rows.map(x => x.r.personId)])];
  const persons: PersonRow[] = ids.map(id => {
    const p = people.get(id), mine = rows.filter(x => x.r.personId === id);
    return { id, name: p?.name || 'Former colleague', market: p?.market || '', team: teamOf(id), active: !!p?.active, rows: mine, ...tally(mine) };
  }).sort(best);
  const names = [...new Set(persons.map(p => p.team))];
  const teams: TeamRow[] = names.map(t => ({
    t, people: data.people.filter(p => p.active && p.role === 'sales' && (p.team || 'No team') === t).length,
    members: persons.filter(p => p.team === t), ...tally(rows.filter(x => teamOf(x.r.personId) === t)),
  })).sort(best);

  return {
    today, events, ev, people, rows,
    kpi: {
      upcoming: up.length, total: events.length, key: key.length, keyCovered: key.filter(e => approvedAt.has(e.id)).length,
      ahead: trips.length, aheadEvents: new Set(trips.map(x => x.e.id)).size, waiting: rows.filter(x => x.r.status === 'requested').length,
      budget: appr.reduce((a, x) => a + Number(x.r.cost || 0), 0), leads, debriefs: deb.length, meetings: deb.reduce((a, x) => a + (x.r.meetingsHeld || 0), 0),
      due: went.length - deb.length, costPerLead: spendDeb > 0 && leads ? spendDeb / leads : null,
    },
    teams, persons,
    regions: REGIONS.filter(r => r !== 'Other').map(region => {
      const u = up.filter(e => e.reg === region && e.tk >= 1 && e.tk <= 3);
      return { region, label: REGION_LABEL[region], covered: u.filter(e => approvedAt.has(e.id)).length, total: u.length };
    }),
    results: went.slice().sort((a, b) => (b.r.leads ?? -1) - (a.r.leads ?? -1)),
    trips,
    gaps: key.filter(e => !approvedAt.has(e.id) && !askedAt.has(e.id)).sort((a, b) => +a.sd! - +b.sd!).map(e => ({ e, flagged: flagged.has(e.id) })),
  };
}
