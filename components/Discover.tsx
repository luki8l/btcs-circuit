'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import Season from './Season';
import Calendar from './Calendar';
import { Tier, DateBlock, Av, Dropdown, Blank } from './ui';
import { IcSearch, IcX, IcExpand, IcCollapse, IcDots, IcGrid, IcList, IcPlus, IcFlag, IcCheck } from './icons';
import {
  NO_FILTERS, GROUPS, GS, REGIONS, REGION_LABEL, KINDS, SIZES, ML, POLICY, matches, filtersToQuery, queryToFilters, sizeBucket, mIdx, monthKey, monthLabel, keyToIdx, dateLabel, place, isStaff,
  type Ev, type Filters, type Presence,
} from '@/lib/model';

type View = 'list' | 'calendar' | 'year';
const MARKET_CC: Record<string, string[]> = { Austria: ['AT'], Germany: ['DE'], Liechtenstein: ['FL', 'LI'], Netherlands: ['NL'], Portugal: ['PT'], Sweden: ['SE', 'SWE'], Switzerland: ['CH'], Spain: ['ES'], France: ['FR'], 'United Kingdom': ['UK'], Italy: ['IT'], Finland: ['FIN'], Denmark: ['DK'], Norway: ['NO'] };
const PRES: Record<Presence, string> = { going: 'Someone is going', requested: 'Waiting for approval', open: 'Nobody from us yet', flagged: 'Roman wants someone there', mine: 'My requests' };

export default function Discover() {
  const { events, presence, me, group, setGroup, data, open, today } = useApp();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>('list');
  const [sort, setSort] = useState<'date' | 'fit' | 'tier'>('date');
  const [full, setFull] = useState(false);
  const [calMonth, setCalMonth] = useState(mIdx(today));
  const [ready, setReady] = useState(false);
  const [howto, setHowto] = useState(me.role === 'sales');

  useEffect(() => {
    const u = new URL(location.href);
    setF(queryToFilters(u.searchParams));
    const v = u.searchParams.get('view'); if (v === 'calendar' || v === 'year' || v === 'list') setView(v);
    const s = u.searchParams.get('sort'); if (s === 'fit' || s === 'tier') setSort(s);
    const cm = u.searchParams.get('month'); if (cm && /^\d{4}-\d{2}$/.test(cm)) setCalMonth(keyToIdx(cm));
    try { setHowto(me.role === 'sales' && localStorage.getItem('circuit.howto') !== '0'); } catch { setHowto(me.role === 'sales'); }
    setReady(true);
  }, [me.role]);
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(filtersToQuery(f));
    if (view !== 'list') q.set('view', view);
    if (sort !== 'date') q.set('sort', sort);
    if (view === 'calendar' && calMonth !== mIdx(today)) q.set('month', monthKey(calMonth));
    const e = new URL(location.href).searchParams.get('e'); if (e) q.set('e', e);
    const s = q.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); } catch { /* ignore */ }
  }, [f, view, sort, calMonth, ready, today]);
  useEffect(() => { if (!full) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.drawer')) setFull(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [full]);
  const hideHowto = () => { setHowto(false); try { localStorage.setItem('circuit.howto', '0'); } catch { /* ignore */ } };

  const hit = useMemo(() => new Set(events.filter(e => matches(e, f, presence(e.id))).map(e => e.id)), [events, f, presence]);
  const facet = (k: keyof Filters, val: (e: Ev) => string | number) => {
    const c = new Map<string | number, number>();
    for (const e of events) if (matches(e, f, presence(e.id), k)) { const v = val(e); c.set(v, (c.get(v) || 0) + 1); }
    return c;
  };
  const fc = useMemo(() => ({
    tiers: facet('tiers', e => e.tk), regions: facet('regions', e => e.reg), kinds: facet('kinds', e => e.group), sizes: facet('sizes', e => sizeBucket(e.size)), countries: facet('countries', e => e.country),
  }), [events, f, presence]); // eslint-disable-line react-hooks/exhaustive-deps
  const presCount = useMemo(() => {
    const out: Record<Presence, number> = { going: 0, requested: 0, open: 0, flagged: 0, mine: 0 };
    for (const e of events) if (matches(e, f, presence(e.id), 'presence')) { const p = presence(e.id); if (p.approved.length) out.going++; if (p.requested.length) out.requested++; if (!p.approved.length && !p.requested.length) out.open++; if (p.flagged) out.flagged++; if (p.mine) out.mine++; }
    return out;
  }, [events, f, presence]);

  const dated = events.filter(e => e.sd && e.mode !== 'tbd');
  const minM = Math.min(...dated.map(e => mIdx(e.sd!))), maxM = Math.max(...dated.map(e => mIdx(e.sd!)));
  const cur = mIdx(today);
  const from = f.from ? keyToIdx(f.from) : f.when === 'upcoming' ? Math.max(minM, cur) : minM;
  const to = f.to ? keyToIdx(f.to) : f.when === 'past' ? Math.min(maxM, cur) : maxM;
  const toggle = <K extends 'tiers' | 'regions' | 'countries' | 'kinds' | 'sizes' | 'presence'>(k: K, v: Filters[K][number]) =>
    setF(x => { const a = x[k] as (typeof v)[]; return { ...x, [k]: a.includes(v) ? a.filter(y => y !== v) : [...a, v] }; });

  // "When" presets
  const WHEN: [string, Partial<Filters>][] = [
    ['All upcoming', { when: 'upcoming', from: '', to: '' }],
    ['This month', { when: 'upcoming', from: monthKey(cur), to: monthKey(cur) }],
    ['Next 3 months', { when: 'upcoming', from: monthKey(cur), to: monthKey(cur + 2) }],
    ['Next 6 months', { when: 'upcoming', from: monthKey(cur), to: monthKey(cur + 5) }],
    ['Past events', { when: 'past', from: '', to: '' }],
    ['Everything', { when: 'all', from: '', to: '' }],
  ];
  const whenNow = WHEN.find(([, w]) => w.when === f.when && w.from === f.from && w.to === f.to)?.[0] || `${f.from ? monthLabel(keyToIdx(f.from)) : 'Start'} – ${f.to ? monthLabel(keyToIdx(f.to)) : 'end'}`;
  const myCC = MARKET_CC[me.market] || [];
  const quick: [string, Filters, boolean][] = [
    ['All upcoming', NO_FILTERS, true],
    ['Key events (Tier 1–2)', { ...NO_FILTERS, tiers: [1, 2] }, true],
    ['Nobody from us yet', { ...NO_FILTERS, tiers: [1, 2, 3], presence: ['open'] }, true],
    ['Roman wants someone', { ...NO_FILTERS, presence: ['flagged'] }, data.flags.length > 0],
    [`Good fit for ${GS[group]}`, { ...NO_FILTERS, fitGroup: group, fitMin: 4 }, true],
    [`In ${me.market}`, { ...NO_FILTERS, countries: myCC }, myCC.length > 0],
    ['My requests', { ...NO_FILTERS, when: 'all', presence: ['mine'] }, data.requests.some(r => r.personId === me.id)],
  ];
  const same = (a: Filters, b: Filters) => filtersToQuery(a) === filtersToQuery(b);
  const quickOn = quick.some(([, q]) => same(f, q));

  const chips: [string, () => void][] = [];
  if (!quickOn) {
    if (f.q) chips.push([`“${f.q}”`, () => setF({ ...f, q: '' })]);
    f.tiers.forEach(t => chips.push([t ? `Tier ${t}` : 'Not rated', () => toggle('tiers', t)]));
    f.regions.forEach(r => chips.push([REGION_LABEL[r], () => toggle('regions', r)]));
    f.countries.forEach(c => chips.push([c, () => toggle('countries', c)]));
    f.kinds.forEach(k => chips.push([KINDS[k], () => toggle('kinds', k)]));
    f.sizes.forEach(s => chips.push([`Size ${s}`, () => toggle('sizes', s)]));
    f.presence.forEach(p => chips.push([PRES[p], () => toggle('presence', p)]));
    if (f.fitGroup >= 0 && f.fitMin) chips.push([`${GS[f.fitGroup]} fit ${f.fitMin}+`, () => setF({ ...f, fitGroup: -1, fitMin: 0 })]);
  }
  const moreCount = f.kinds.length + f.sizes.length + f.countries.length + f.presence.length + (f.fitGroup >= 0 && f.fitMin ? 1 : 0);

  const list = useMemo(() => {
    const l = events.filter(e => hit.has(e.id));
    // month-only events go to the end of their month, after the ones with a date
    const dk = (e: Ev) => !e.sd ? 9e15 : e.mode === 'month' && e.endCheck ? +e.endCheck + 43200000 : +e.sd;
    if (sort === 'fit') l.sort((a, b) => (b.fit[group] || 0) - (a.fit[group] || 0) || (a.tk || 9) - (b.tk || 9) || dk(a) - dk(b));
    else if (sort === 'tier') l.sort((a, b) => (a.tk || 9) - (b.tk || 9) || dk(a) - dk(b));
    else l.sort((a, b) => dk(a) - dk(b) || (a.tk || 9) - (b.tk || 9));
    return l;
  }, [events, hit, sort, group]);
  // the calendar ignores “upcoming / past”: a month shows all its days
  const calEvents = useMemo(() => events.filter(e => matches(e, { ...f, from: '', to: '' }, presence(e.id), 'when')), [events, f, presence]);
  const countries = [...fc.countries.entries()].filter(([c]) => c && c !== 'TBA').sort((a, b) => b[1] - a[1]).slice(0, 16);
  const up = events.filter(e => !e.past);

  const viewSwitch = (
    <div className="seg" role="group" aria-label="View">
      <button aria-pressed={view === 'list'} onClick={() => setView('list')}><IcList />List</button>
      <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><IcGrid />Calendar</button>
      <button aria-pressed={view === 'year'} onClick={() => setView('year')}><IcDots />Year</button>
    </div>
  );
  const fullBtn = <button className="btn line sm" onClick={() => setFull(x => !x)}>{full ? <><IcCollapse />Close full screen</> : <><IcExpand />Full screen</>}</button>;
  const legend = (
    <div className="legend">
      {[1, 2, 3, 4, 5].map(t => <span key={t}><i className="lg-dot" style={{ background: `var(--t${t})` }} />Tier {t}</span>)}
      <span><i className="lg-ring" />Someone going</span><span><i className="lg-ring req" />Waiting</span>{data.flags.length > 0 && <span><i className="lg-ring flag" />Roman wants someone</span>}
    </div>
  );
  const year = (big: boolean) => (
    <div className="panel" style={{ padding: big ? 16 : '18px 18px 10px' }}>
      {!big && <div className="panel-h"><div><h2 className="h2">The year at a glance</h2><p>Every dot is an event. Rows are the tiers, left to right is time, bigger dots mean bigger audiences. Click a dot to open it.</p></div><div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{fullBtn}</div></div>}
      <div style={{ marginBottom: 10 }}>{legend}</div>
      <Season events={events} hit={hit} from={Math.min(from, to)} to={Math.max(from, to)} big={big} />
    </div>
  );

  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">External events</h1>
          <p className="lede">{up.length} upcoming conferences from the 2026/27 masterlist. Find one, request your spot, and Roman approves it.</p></div>
        <div className="actions">
          <button className="btn line" onClick={() => open({ kind: 'suggest' })}><IcPlus />Suggest an event</button>
          {isStaff(me.role) && <button className="btn dark" onClick={() => open({ kind: 'edit', id: null })}><IcPlus />Add event</button>}
        </div>
      </section>

      {howto && (
        <section className="howto" aria-label="How it works">
          <div className="st"><i>1</i><div><b>Find an event</b><span>List, calendar or year view. Tier 1–2 are the key events.</span></div></div>
          <div className="st"><i>2</i><div><b>Request your spot</b><span>Say how you go and if you need a ticket. Takes 20 seconds.</span></div></div>
          <div className="st"><i>3</i><div><b>Get approved, then HubSpot</b><span>Roman decides. Log it in HubSpot, debrief after the event.</span></div></div>
          <button className="x" onClick={hideHowto} aria-label="Hide this"><IcX /></button>
        </section>
      )}

      <div className="toolbar">
        <label className="search"><IcSearch /><input className="input" type="search" placeholder="Search by name, city or country" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} aria-label="Search events" /></label>
        <Dropdown label="When" value={whenNow} active={whenNow !== 'All upcoming'}>{close => <>
          {WHEN.map(([l, w]) => <button key={l} className="dd-opt" onClick={() => { setF({ ...f, ...w }); close(); }}><span className={`radio ${whenNow === l ? 'on' : ''}`} />{l}</button>)}
        </>}</Dropdown>
        <Dropdown label="Tier" value={f.tiers.length ? f.tiers.map(t => t || '–').join(', ') : undefined} active={f.tiers.length > 0}>{() => <>
          {[1, 2, 3, 4, 5, 0].map(t => <button key={t} className="dd-opt" onClick={() => toggle('tiers', t)}><span className={`check ${f.tiers.includes(t) ? 'on' : ''}`}>{f.tiers.includes(t) && <IcCheck s={11} />}</span><Tier e={{ tk: t }} /><span className="dim small">{t ? POLICY[t][0] : ''}</span><span className="n">{fc.tiers.get(t) || 0}</span></button>)}
        </>}</Dropdown>
        <Dropdown label="Region" value={f.regions.length ? f.regions.map(r => REGION_LABEL[r]).join(', ') : undefined} active={f.regions.length > 0}>{() => <>
          {REGIONS.map(r => <button key={r} className="dd-opt" onClick={() => toggle('regions', r)}><span className={`check ${f.regions.includes(r) ? 'on' : ''}`}>{f.regions.includes(r) && <IcCheck s={11} />}</span>{REGION_LABEL[r]}<span className="n">{fc.regions.get(r) || 0}</span></button>)}
        </>}</Dropdown>
        <Dropdown label="More filters" value={moreCount ? String(moreCount) : undefined} active={moreCount > 0}>{() => <div style={{ width: 300 }}>
          <p className="lab dd-h">Bitcoin Suisse</p>
          {(Object.keys(PRES) as Presence[]).filter(p => p !== 'flagged' || data.flags.length).map(p => <button key={p} className="dd-opt" onClick={() => toggle('presence', p)}><span className={`check ${f.presence.includes(p) ? 'on' : ''}`}>{f.presence.includes(p) && <IcCheck s={11} />}</span>{PRES[p]}<span className="n">{presCount[p]}</span></button>)}
          <div className="dd-sep" /><p className="lab dd-h">Good fit for (4 or 5 out of 5)</p>
          {GROUPS.map((g, i) => <button key={g} className="dd-opt" onClick={() => setF({ ...f, fitGroup: f.fitGroup === i ? -1 : i, fitMin: f.fitGroup === i ? 0 : 4 })}><span className={`radio ${f.fitGroup === i && f.fitMin ? 'on' : ''}`} />{g}</button>)}
          <div className="dd-sep" /><p className="lab dd-h">Kind</p>
          {Object.entries(KINDS).map(([k, l]) => <button key={k} className="dd-opt" onClick={() => toggle('kinds', k)}><span className={`check ${f.kinds.includes(k) ? 'on' : ''}`}>{f.kinds.includes(k) && <IcCheck s={11} />}</span>{l}<span className="n">{fc.kinds.get(k) || 0}</span></button>)}
          <div className="dd-sep" /><p className="lab dd-h">Audience size</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 8px 8px' }}>{SIZES.map(s => <button key={s} className="chip" aria-pressed={f.sizes.includes(s)} onClick={() => toggle('sizes', s)}>{s}<span className="n">{fc.sizes.get(s) || 0}</span></button>)}</div>
          <div className="dd-sep" /><p className="lab dd-h">Country</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 8px 8px' }}>{countries.map(([c, n]) => <button key={String(c)} className="chip" aria-pressed={f.countries.includes(String(c))} onClick={() => toggle('countries', String(c))}>{c}<span className="n">{n}</span></button>)}</div>
        </div>}</Dropdown>
        <span className="sp" />
        {viewSwitch}
      </div>
      <div className="quick">{quick.filter(q => q[2]).map(([l, qf]) => <button key={l} className="chip" aria-pressed={same(f, qf)} onClick={() => setF(qf)}>{l}</button>)}</div>
      {chips.length > 0 && <div className="active-f">{chips.map(([l, x]) => <button key={l} className="chip" onClick={x}>{l}<IcX s={13} /></button>)}<button className="btn ghost sm" onClick={() => setF(NO_FILTERS)}>Reset</button></div>}

      {view !== 'calendar' && <div className="count-line"><span><b>{hit.size}</b> event{hit.size === 1 ? '' : 's'}</span>
        {view === 'list' && <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Sort by<select className="select sm" style={{ width: 190 }} value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="date">Date</option><option value="tier">Tier</option><option value="fit">Fit for {GS[group]}</option></select></label>}
      </div>}

      {view === 'list' && <List list={list} grouped={sort === 'date'} reset={() => setF(NO_FILTERS)} />}
      {view === 'calendar' && <Calendar events={calEvents} month={calMonth} setMonth={setCalMonth} tools={fullBtn} />}
      {view === 'year' && year(false)}

      {full && (
        <div className="full" role="dialog" aria-label="Full screen">
          <div className="full-h">
            <h2 className="title">{view === 'calendar' ? 'Calendar' : 'The year at a glance'} <span className="dim" style={{ fontWeight: 400 }}>· {hit.size} events</span></h2>
            <span className="sp" />
            <div className="seg"><button aria-pressed={view !== 'calendar'} onClick={() => setView('year')}><IcDots />Year</button><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><IcGrid />Calendar</button></div>
            {fullBtn}
          </div>
          <div className="full-b">{view === 'calendar' ? <Calendar events={calEvents} month={calMonth} setMonth={setCalMonth} big /> : year(true)}</div>
        </div>
      )}

      <p className="foot">Events, tiers, team ratings and fit come from the “BTCS H2 2026 and 2027 Events Masterlist”. “Month only” means the masterlist has no exact day yet. Tip: press ⌘K (Ctrl+K) anywhere to jump to an event.</p>
      {/* your main target group, used for “Good fit” and sorting */}
      <div className="dim small" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>Your main target group:
        <select className="select sm" style={{ width: 'auto' }} value={group} onChange={e => setGroup(Number(e.target.value))} aria-label="Your main target group">{GS.map((g, i) => <option key={g} value={i}>{g}</option>)}</select></div>
    </main>
  );
}

function List({ list, grouped, reset }: { list: Ev[]; grouped: boolean; reset: () => void }) {
  const { open, presence, people, me } = useApp();
  if (!list.length) return <div className="card"><Blank icon={<IcSearch s={22} />} title="No events match" text="Try fewer filters or another search." action={<button className="btn" onClick={reset}>Show all upcoming events</button>} /></div>;
  const row = (e: Ev) => {
    const p = presence(e.id), all = [...p.approved, ...p.requested], mine = all.find(r => r.personId === me.id);
    return (
      <div key={e.id} className={`erow ${e.past ? 'past' : ''}`} tabIndex={0} role="button" aria-label={e.name} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })} onKeyDown={x => { if (x.key === 'Enter') open({ kind: 'event', id: e.id, view: 'detail' }); }}>
        <DateBlock e={e} />
        <div style={{ minWidth: 0 }}><div className="nm">{e.name}{e.isNew && <span className="tag">New</span>}{e.source === 'suggestion' && <span className="tag">Suggested</span>}</div>
          <div className="sub">{place(e)}{e.kind ? ` · ${e.kind}` : ''}{e.mode !== 'exact' ? ` · ${dateLabel(e)}` : ''}</div></div>
        <Tier e={e} full />
        <div className="presence">{all.length ? <><span className="avs">{all.slice(0, 4).map(r => <Av key={r.id} p={people.get(r.personId)} req={r.status === 'requested'} size="sm" />)}</span>{p.approved.length ? `${p.approved.length} going` : ''}{p.approved.length && p.requested.length ? ' · ' : ''}{p.requested.length ? `${p.requested.length} waiting` : ''}</>
          : p.flagged ? <span className="flag"><IcFlag s={13} />Roman wants someone</span> : 'Nobody from us yet'}</div>
        <div className="act" onClick={x => x.stopPropagation()}>
          {mine ? <span className={`pill ${mine.status === 'approved' ? 'ok' : 'wait'}`}><i />{mine.status === 'approved' ? 'You’re going' : 'Requested'}</span>
            : e.past ? <span className="dim small">Over</span>
              : <button className="btn soft sm" onClick={() => open({ kind: 'event', id: e.id, view: 'request' })}>Request a spot</button>}
        </div>
      </div>
    );
  };
  if (!grouped) return <div className="rows">{list.map(row)}</div>;
  const g = new Map<string, Ev[]>(); list.forEach(e => { const a = g.get(e.mk) || []; a.push(e); g.set(e.mk, a); });
  return <>{[...g.entries()].map(([k, es]) => {
    const going = es.filter(e => presence(e.id).approved.length).length;
    return (
      <section key={k} className="mgroup">
        <h3><b>{k === 'TBD' ? 'Date not known yet' : `${ML[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`}</b><span>{es.length} event{es.length === 1 ? '' : 's'}{going ? ` · we’re at ${going}` : ''}</span></h3>
        <div className="rows">{es.map(row)}</div>
      </section>
    );
  })}</>;
}
