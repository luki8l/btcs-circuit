'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import Season from './Season';
import Calendar from './Calendar';
import { Tier, DateBlock, Av, FitMini } from './ui';
import { IcSearch, IcX, IcExpand, IcCollapse, IcFilter, IcDots, IcGrid, IcList, IcPlus, IcFlag } from './icons';
import {
  NO_FILTERS, GROUPS, GS, REGIONS, REGION_LABEL, KINDS, SIZES, ML, MS, matches, filtersToQuery, queryToFilters, sizeBucket, mIdx, monthKey, monthLabel, keyToIdx, dateLabel, place,
  type Ev, type Filters, type Presence,
} from '@/lib/model';

type View = 'season' | 'calendar' | 'list';
const MARKET_CC: Record<string, string[]> = { Austria: ['AT'], Germany: ['DE'], Liechtenstein: ['FL', 'LI'], Netherlands: ['NL'], Portugal: ['PT'], Sweden: ['SE', 'SWE'], Switzerland: ['CH'], Spain: ['ES'], France: ['FR'], 'United Kingdom': ['UK'], Italy: ['IT'], Finland: ['FIN'], Denmark: ['DK'], Norway: ['NO'] };
const PRES: Record<Presence, string> = { going: 'Bitcoin Suisse going', requested: 'Waiting for approval', open: 'No one yet', flagged: 'Flagged by events team', mine: 'Mine' };

export default function Discover() {
  const { events, presence, me, group, setGroup, data, open, today } = useApp();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>('season');
  const [sort, setSort] = useState<'date' | 'fit' | 'tier'>('date');
  const [panel, setPanel] = useState(false);
  const [full, setFull] = useState(false);
  const [calMonth, setCalMonth] = useState(mIdx(today));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = new URL(location.href);
    setF(queryToFilters(u.searchParams));
    const v = u.searchParams.get('view'); if (v === 'calendar' || v === 'list' || v === 'season') setView(v);
    const s = u.searchParams.get('sort'); if (s === 'fit' || s === 'tier') setSort(s);
    const cm = u.searchParams.get('month'); if (cm && /^\d{4}-\d{2}$/.test(cm)) setCalMonth(keyToIdx(cm));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(filtersToQuery(f));
    if (view !== 'season') q.set('view', view);
    if (sort !== 'date') q.set('sort', sort);
    if (view === 'calendar' && calMonth !== mIdx(today)) q.set('month', monthKey(calMonth));
    const e = new URL(location.href).searchParams.get('e'); if (e) q.set('e', e);
    const s = q.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); } catch { /* ignore */ }
  }, [f, view, sort, calMonth, ready, today]);
  useEffect(() => { if (!full) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.drawer')) setFull(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [full]);

  const hit = useMemo(() => new Set(events.filter(e => matches(e, f, presence(e.id))).map(e => e.id)), [events, f, presence]);
  const facet = (k: keyof Filters, val: (e: Ev) => string | number) => {
    const c = new Map<string | number, number>();
    for (const e of events) if (matches(e, f, presence(e.id), k)) { const v = val(e); c.set(v, (c.get(v) || 0) + 1); }
    return c;
  };
  const fc = useMemo(() => ({
    tiers: facet('tiers', e => e.tk), regions: facet('regions', e => e.reg), kinds: facet('kinds', e => e.group), sizes: facet('sizes', e => sizeBucket(e.size)),
    countries: facet('countries', e => e.country),
  }), [events, f, presence]); // eslint-disable-line react-hooks/exhaustive-deps
  const presCount = useMemo(() => {
    const out: Record<Presence, number> = { going: 0, requested: 0, open: 0, flagged: 0, mine: 0 };
    for (const e of events) if (matches(e, f, presence(e.id), 'presence')) { const p = presence(e.id); if (p.approved.length) out.going++; if (p.requested.length) out.requested++; if (!p.approved.length && !p.requested.length) out.open++; if (p.flagged) out.flagged++; if (p.mine) out.mine++; }
    return out;
  }, [events, f, presence]);

  const dated = events.filter(e => e.sd && e.mode !== 'tbd');
  const minM = Math.min(...dated.map(e => mIdx(e.sd!))), maxM = Math.max(...dated.map(e => mIdx(e.sd!)));
  const from = f.from ? keyToIdx(f.from) : f.when === 'upcoming' ? Math.max(minM, mIdx(today)) : minM;
  const to = f.to ? keyToIdx(f.to) : f.when === 'past' ? Math.min(maxM, mIdx(today)) : maxM;
  const monthOpts: number[] = []; for (let i = minM; i <= maxM; i++) monthOpts.push(i);

  const toggle = <K extends 'tiers' | 'regions' | 'countries' | 'kinds' | 'sizes' | 'presence'>(k: K, v: Filters[K][number]) =>
    setF(x => { const a = x[k] as (typeof v)[]; return { ...x, [k]: a.includes(v) ? a.filter(y => y !== v) : [...a, v] }; });
  const myCC = MARKET_CC[me.market] || [];
  const up = events.filter(e => !e.past);
  const t12 = up.filter(e => (e.tk === 1 || e.tk === 2) && e.mode !== 'tbd');
  const quick: [string, Filters, boolean][] = [
    ['Upcoming', NO_FILTERS, true],
    ['Next 90 days', { ...NO_FILTERS, from: monthKey(mIdx(today)), to: monthKey(mIdx(today) + 2) }, true],
    ['Tier 1–2, no one yet', { ...NO_FILTERS, tiers: [1, 2], presence: ['open'] }, true],
    ['Flagged by events team', { ...NO_FILTERS, presence: ['flagged'] }, data.flags.length > 0],
    [`Strong fit: ${GS[group]}`, { ...NO_FILTERS, fitGroup: group, fitMin: 4 }, true],
    [`In ${me.market || 'my market'}`, { ...NO_FILTERS, countries: myCC }, myCC.length > 0],
    ['Mine', { ...NO_FILTERS, when: 'all', presence: ['mine'] }, true],
  ];
  const same = (a: Filters, b: Filters) => filtersToQuery(a) === filtersToQuery(b);
  const activeChips: [string, () => void][] = [];
  if (f.q) activeChips.push([`“${f.q}”`, () => setF({ ...f, q: '' })]);
  if (f.when !== 'upcoming') activeChips.push([f.when === 'all' ? 'Incl. past events' : 'Past only', () => setF({ ...f, when: 'upcoming' })]);
  if (f.from) activeChips.push([`From ${monthLabel(keyToIdx(f.from))}`, () => setF({ ...f, from: '' })]);
  if (f.to) activeChips.push([`To ${monthLabel(keyToIdx(f.to))}`, () => setF({ ...f, to: '' })]);
  f.tiers.forEach(t => activeChips.push([t ? `Tier ${t}` : 'Unrated', () => toggle('tiers', t)]));
  f.regions.forEach(r => activeChips.push([REGION_LABEL[r], () => toggle('regions', r)]));
  f.countries.forEach(c => activeChips.push([c, () => toggle('countries', c)]));
  f.kinds.forEach(k => activeChips.push([KINDS[k], () => toggle('kinds', k)]));
  f.sizes.forEach(s => activeChips.push([`Size ${s}`, () => toggle('sizes', s)]));
  f.presence.forEach(p => activeChips.push([PRES[p], () => toggle('presence', p)]));
  if (f.fitGroup >= 0 && f.fitMin) activeChips.push([`${GS[f.fitGroup]} fit ≥ ${f.fitMin}`, () => setF({ ...f, fitGroup: -1, fitMin: 0 })]);
  const nFilters = activeChips.length;

  const list = useMemo(() => {
    const l = events.filter(e => hit.has(e.id));
    const dk = (e: Ev) => e.sd ? +e.sd : 9e15;
    if (sort === 'fit') l.sort((a, b) => (b.fit[group] || 0) - (a.fit[group] || 0) || (a.tk || 9) - (b.tk || 9) || dk(a) - dk(b));
    else if (sort === 'tier') l.sort((a, b) => (a.tk || 9) - (b.tk || 9) || dk(a) - dk(b));
    else l.sort((a, b) => dk(a) - dk(b) || (a.tk || 9) - (b.tk || 9));
    return l;
  }, [events, hit, sort, group]);
  // the calendar ignores “upcoming / past”: a month shows all its days
  const calEvents = useMemo(() => events.filter(e => matches(e, { ...f, from: '', to: '' }, presence(e.id), 'when')), [events, f, presence]);
  const countries = [...fc.countries.entries()].filter(([c]) => c && c !== 'TBA').sort((a, b) => b[1] - a[1]);

  const viewSwitch = (
    <div className="seg" role="group" aria-label="View">
      <button aria-pressed={view === 'season'} onClick={() => setView('season')}><IcDots />Season</button>
      <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><IcGrid />Calendar</button>
      <button aria-pressed={view === 'list'} onClick={() => setView('list')}><IcList />List</button>
    </div>
  );
  const fullBtn = <button className="btn line sm" onClick={() => setFull(x => !x)} aria-label={full ? 'Exit full screen' : 'Full screen'}>{full ? <><IcCollapse />Exit</> : <><IcExpand />Full screen</>}</button>;
  const legend = (
    <div className="legend">
      {[1, 2, 3, 4, 5].map(t => <span key={t}><i className="lg-dot" style={{ background: `var(--t${t})` }} />T{t}</span>)}
      <span><i className="lg-ring" />Going</span><span><i className="lg-ring req" />Waiting</span><span><i className="lg-ring flag" />Flagged</span>
    </div>
  );
  const monthRange = (
    <div className="range">
      <select className="select sm" style={{ width: 130 }} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} aria-label="From month"><option value="">From: start</option>{monthOpts.map(i => <option key={i} value={monthKey(i)}>{monthLabel(i)}</option>)}</select>
      <select className="select sm" style={{ width: 130 }} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} aria-label="To month"><option value="">To: end</option>{monthOpts.map(i => <option key={i} value={monthKey(i)}>{monthLabel(i)}</option>)}</select>
    </div>
  );
  const seasonCard = (big: boolean) => (
    <div className={big ? '' : 'panel'} style={big ? undefined : { padding: '16px 16px 8px' }}>
      {!big && <div className="panel-h"><div><h2 className="h2">The season at a <em>glance</em></h2><p>Each dot is an event: lane = 2027 tier, size = audience, position = date. Click a dot.</p></div><div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{legend}{fullBtn}</div></div>}
      <Season events={events} hit={hit} from={Math.min(from, to)} to={Math.max(from, to)} big={big} />
    </div>
  );

  return (
    <main className="page">
      <section className="head">
        <div><p className="k">External events · 2026/27 masterlist</p><h1 className="title">Where we <em>show up</em>.</h1>
          <p className="lede">Every conference on one screen. See who from Bitcoin Suisse is going, request your spot, and get it approved in one click.</p></div>
        <div className="stats">
          <div className="stat"><b className="num">{up.length}</b><span>upcoming events</span></div>
          <div className="stat"><b className="num">{t12.filter(e => presence(e.id).approved.length).length}<span className="of">/{t12.length}</span></b><span>Tier 1–2 covered</span></div>
          <div className="stat red"><b className="num">{data.flags.filter(x => !events.find(e => e.id === x.eventId)?.past).length}</b><span>flagged by events team</span></div>
        </div>
      </section>

      <div className="toolbar">
        {viewSwitch}
        <label className="search"><IcSearch /><input className="input" type="search" placeholder="Search name, city, country, topic…" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} aria-label="Search events" /></label>
        <button className={`btn ${panel ? 'white' : 'line'}`} onClick={() => setPanel(p => !p)} aria-expanded={panel}><IcFilter />Filters{nFilters ? ` · ${nFilters}` : ''}</button>
        <button className="btn line" onClick={() => open({ kind: 'suggest' })}><IcPlus />Suggest event</button>
      </div>
      <div className="quick"><span className="lab">Quick</span>{quick.filter(q => q[2]).map(([l, qf]) => <button key={l} className="chip" aria-pressed={same(f, qf)} onClick={() => setF(qf)}>{l}</button>)}</div>

      {panel && (
        <div className="fpanel">
          <div className="fgroup"><div className="lab"><span>When</span></div>
            <div className="chips">{([['upcoming', 'Upcoming'], ['all', 'All'], ['past', 'Past']] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={f.when === k} onClick={() => setF({ ...f, when: k })}>{l}</button>)}</div>
            <div style={{ marginTop: 10 }}>{monthRange}</div></div>
          <div className="fgroup"><div className="lab"><span>Tier 2027</span>{f.tiers.length > 0 && <button onClick={() => setF({ ...f, tiers: [] })}>clear</button>}</div>
            <div className="chips">{[1, 2, 3, 4, 5, 0].map(t => <button key={t} className="chip" aria-pressed={f.tiers.includes(t)} onClick={() => toggle('tiers', t)} disabled={!fc.tiers.get(t) && !f.tiers.includes(t)}>{t ? <><i className="sw" style={{ background: `var(--t${t})` }} />T{t}</> : 'Unrated'}<span className="n">{fc.tiers.get(t) || 0}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Bitcoin Suisse</span>{f.presence.length > 0 && <button onClick={() => setF({ ...f, presence: [] })}>clear</button>}</div>
            <div className="chips">{(Object.keys(PRES) as Presence[]).map(p => <button key={p} className="chip" aria-pressed={f.presence.includes(p)} onClick={() => toggle('presence', p)}>{PRES[p]}<span className="n">{presCount[p]}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Region</span>{f.regions.length > 0 && <button onClick={() => setF({ ...f, regions: [] })}>clear</button>}</div>
            <div className="chips">{REGIONS.map(r => <button key={r} className="chip" aria-pressed={f.regions.includes(r)} onClick={() => toggle('regions', r)} disabled={!fc.regions.get(r) && !f.regions.includes(r)}>{REGION_LABEL[r]}<span className="n">{fc.regions.get(r) || 0}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Country</span>{f.countries.length > 0 && <button onClick={() => setF({ ...f, countries: [] })}>clear</button>}</div>
            <div className="chips">{countries.slice(0, 14).concat(f.countries.filter(c => !countries.slice(0, 14).some(x => x[0] === c)).map(c => [c, 0] as [string, number])).map(([c, n]) => <button key={String(c)} className="chip" aria-pressed={f.countries.includes(String(c))} onClick={() => toggle('countries', String(c))}>{c}<span className="n">{n}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Kind</span></div>
            <div className="chips">{Object.entries(KINDS).map(([k, l]) => <button key={k} className="chip" aria-pressed={f.kinds.includes(k)} onClick={() => toggle('kinds', k)}>{l}<span className="n">{fc.kinds.get(k) || 0}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Audience size</span></div>
            <div className="chips">{SIZES.map(s => <button key={s} className="chip" aria-pressed={f.sizes.includes(s)} onClick={() => toggle('sizes', s)} disabled={!fc.sizes.get(s) && !f.sizes.includes(s)}>{s}<span className="n">{fc.sizes.get(s) || 0}</span></button>)}</div></div>
          <div className="fgroup"><div className="lab"><span>Buy-side fit</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select className="select sm" style={{ width: 210 }} value={f.fitGroup} onChange={e => setF({ ...f, fitGroup: Number(e.target.value), fitMin: Number(e.target.value) >= 0 ? f.fitMin || 4 : 0 })} aria-label="Target group"><option value={-1}>Any target group</option>{GROUPS.map((g, i) => <option key={g} value={i}>{g}</option>)}</select>
              <select className="select sm" style={{ width: 100 }} value={f.fitMin} onChange={e => setF({ ...f, fitMin: Number(e.target.value) })} disabled={f.fitGroup < 0} aria-label="Minimum fit"><option value={0}>any</option>{[3, 4, 5].map(n => <option key={n} value={n}>≥ {n}</option>)}</select>
            </div>
            <p className="dim small" style={{ marginTop: 10 }}>Your main group (ranking, highlights): <select className="select sm" style={{ width: 'auto', display: 'inline-block', marginLeft: 6 }} value={group} onChange={e => setGroup(Number(e.target.value))} aria-label="Your main target group">{GS.map((g, i) => <option key={g} value={i}>{g}</option>)}</select></p></div>
        </div>
      )}
      {nFilters > 0 && <div className="active-f">{activeChips.map(([l, x]) => <button key={l} className="chip" onClick={x}>{l}<IcX s={13} /></button>)}<button className="btn ghost sm" onClick={() => setF(NO_FILTERS)}>Clear all</button></div>}

      <div className="count-line"><b>{hit.size} event{hit.size === 1 ? '' : 's'}</b>
        {view === 'list' && <label className="dim small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Sort<select className="select sm" style={{ width: 200 }} value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="date">By date</option><option value="fit">Best fit: {GS[group]}</option><option value="tier">By tier</option></select></label>}
      </div>

      {view === 'season' && seasonCard(false)}
      {view === 'calendar' && <Calendar events={calEvents} month={calMonth} setMonth={setCalMonth} tools={fullBtn} />}
      {view === 'list' && <List list={list} grouped={sort === 'date'} />}

      {full && (
        <div className="full" role="dialog" aria-label="Full screen">
          <div className="full-h">
            <h2 className="title">{view === 'calendar' ? 'Calendar' : 'Season'} <em style={{ fontStyle: 'normal', color: 'var(--red)' }}>·</em> <span className="dim">{hit.size} events</span></h2>
            <span className="sp" />
            {view !== 'calendar' && <>{legend}{monthRange}</>}
            <div className="seg"><button aria-pressed={view !== 'calendar'} onClick={() => setView('season')}><IcDots />Season</button><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><IcGrid />Calendar</button></div>
            {fullBtn}
          </div>
          <div className="full-b">
            {view === 'calendar' ? <Calendar events={calEvents} month={calMonth} setMonth={setCalMonth} big /> : seasonCard(true)}
          </div>
        </div>
      )}

      <p className="foot">Catalogue from the “BTCS H2 2026 and 2027 Events Masterlist” (sheet INPUT HERE Planning 2027): tier, team ratings, buy-side fit, costs and notes; organiser contact details are not stored here. “Day TBC” means the masterlist only has the month. Shortcuts: ⌘K jump to any event · Esc closes.</p>
    </main>
  );
}

function List({ list, grouped }: { list: Ev[]; grouped: boolean }) {
  const { open, presence, people, group } = useApp();
  if (!list.length) return <div className="card empty">No events match these filters.</div>;
  const row = (e: Ev) => {
    const p = presence(e.id), all = [...p.approved, ...p.requested];
    return (
      <div key={e.id} className={`erow ${e.past ? 'past' : ''}`} tabIndex={0} role="button" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })} onKeyDown={x => { if (x.key === 'Enter') open({ kind: 'event', id: e.id, view: 'detail' }); }}>
        <DateBlock e={e} />
        <div style={{ minWidth: 0 }}><div className="nm">{e.name}{e.isNew && <span className="tag">New</span>}{e.source === 'suggestion' && <span className="tag">Suggested</span>}</div>
          <div className="sub">{place(e)} · {e.kind || 'Type TBA'}{e.size ? ` · ${e.size}` : ''}{e.mode !== 'exact' ? ` · ${dateLabel(e)}` : ''}</div></div>
        <Tier e={e} />
        <FitMini e={e} g={group} />
        <div className="presence">{all.length ? <><span className="avs">{all.slice(0, 4).map(r => <Av key={r.id} p={people.get(r.personId)} req={r.status === 'requested'} size="sm" />)}</span>{p.approved.length} going{p.requested.length ? ` · ${p.requested.length} waiting` : ''}</>
          : p.flagged ? <span className="flag"><IcFlag s={13} /> Wanted</span> : 'No one yet'}</div>
        <span className="chev" aria-hidden="true">›</span>
      </div>
    );
  };
  if (!grouped) return <div>{list.map(row)}</div>;
  const g = new Map<string, Ev[]>(); list.forEach(e => { const a = g.get(e.mk) || []; a.push(e); g.set(e.mk, a); });
  return <>{[...g.entries()].map(([k, es]) => {
    const going = es.filter(e => presence(e.id).approved.length).length;
    return (
      <section key={k} className="mgroup">
        <h3><b>{k === 'TBD' ? 'Date TBD' : `${ML[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`}</b><span>{es.length} events{going ? ` · Bitcoin Suisse at ${going}` : ''}</span></h3>
        {es.map(row)}
      </section>
    );
  })}</>;
}
