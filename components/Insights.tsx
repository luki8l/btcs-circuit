'use client';
// Overview for management and the events team: where Bitcoin Suisse shows up, what it costs and what comes back.
// Works from day one: the event catalogue alone already shows the season and the gaps.
import Link from 'next/link';
import { useMemo } from 'react';
import { useApp, h } from './AppProvider';
import { Tier, DateBlock, Av, Blank } from './ui';
import Season from './Season';
import { IcInfo, IcFlag, IcChart } from './icons';
import { MS, ML, REGIONS, REGION_LABEL, chf, dateLabel, place, mIdx, canSeeInsights, isStaff } from '@/lib/model';

export default function Insights() {
  const { me, data, ev, events, people, presence, open, today } = useApp();
  const all = useMemo(() => new Set(events.map(e => e.id)), [events]);
  if (!canSeeInsights(me.role)) return <main className="page"><h1 className="title">Overview</h1><p className="muted" style={{ marginTop: 12 }}>The overview is for the events team and management.</p></main>;
  const rs = data.requests.filter(r => r.status !== 'withdrawn' && ev.has(r.eventId));
  const appr = rs.filter(r => r.status === 'approved');
  const started = (id: number) => { const e = ev.get(id)!; return e.past || (!!e.sd && e.mode !== 'tbd' && e.sd <= today); };
  const att = appr.filter(r => started(r.eventId));
  const deb = att.filter(r => r.rating);
  const leads = deb.reduce((a, r) => a + (r.leads || 0), 0);
  const spendDeb = deb.reduce((a, r) => a + Number(r.cost || 0), 0);
  const spend = appr.reduce((a, r) => a + Number(r.cost || 0), 0);
  const up = events.filter(e => !e.past);
  const key = up.filter(e => e.mode !== 'tbd' && (e.tk === 1 || e.tk === 2));
  const keyCovered = key.filter(e => presence(e.id).approved.length);
  const goingAhead = appr.filter(r => !started(r.eventId));
  const waiting = rs.filter(r => r.status === 'requested').length;
  const gaps = key.filter(e => !presence(e.id).approved.length && !presence(e.id).requested.length).sort((a, b) => +a.sd! - +b.sd!).slice(0, 8);

  const cur = mIdx(today);
  const dated = up.filter(e => e.sd && e.mode !== 'tbd');
  const m1 = Math.max(...dated.map(e => mIdx(e.sd!)));
  const cols: number[] = []; for (let m = cur; m <= m1; m++) cols.push(m);
  const inMonth = (m: number) => dated.filter(e => mIdx(e.sd!) === m);
  const maxc = Math.max(1, ...cols.map(m => inMonth(m).length));
  const regs = REGIONS.filter(r => r !== 'Other').map(rg => { const u = up.filter(e => e.reg === rg && e.tk >= 1 && e.tk <= 3); return [rg, u.filter(e => presence(e.id).approved.length).length, u.length] as const; });
  const results = att.slice().sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1));

  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">Overview</h1>
          <p className="lede">Where Bitcoin Suisse shows up in the 2026/27 season, what it costs and what comes back. Every number here updates as sales request, Roman approves and people debrief.</p></div>
        <div className="actions"><Link className="btn line" href="/discover">All events</Link>{isStaff(me.role) && <Link className="btn dark" href="/approvals">Requests{waiting ? ` (${waiting})` : ''}</Link>}</div>
      </section>

      <div className="kpis">
        <div className="kpi"><span>Upcoming events</span><b className="num">{up.length}</b><small>of {events.length} in the masterlist</small></div>
        <div className={`kpi ${key.length && keyCovered.length / key.length < .5 ? 'red' : ''}`}><span>Key events covered</span><b className="num">{keyCovered.length}<span className="dim" style={{ fontSize: '.55em' }}> / {key.length}</span></b><small>Tier 1–2 with someone approved</small></div>
        <div className="kpi"><span>Trips approved</span><b className="num">{goingAhead.length}</b><small>{waiting} waiting for Roman</small></div>
        <div className="kpi"><span>Ticket budget approved</span><b className="num">{chf(spend)}</b><small>as entered by sales</small></div>
        <div className="kpi"><span>Leads from events</span><b className="num">{leads}</b><small>{deb.length ? `${chf(spendDeb / Math.max(1, leads))} ticket cost per lead` : 'after the first debriefs'}</small></div>
      </div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-h"><div><h2 className="h2">The season ahead</h2><p>Every dot is an upcoming event: rows are the tiers, left to right is time, bigger dots mean bigger audiences. A black ring means someone from Bitcoin Suisse is going.</p></div>
          <Link className="btn line sm" href="/discover?view=year">Open full view</Link></div>
        <Season events={events} hit={all} from={cur} to={m1} />
      </section>

      <div className="charts">
        <section className="panel">
          <div className="panel-h"><div><h2 className="h2">Key events ahead, nobody from us yet</h2><p>Tier 1–2 events without a request. These are the gaps to fill.</p></div></div>
          {gaps.length ? <div className="gaplist">{gaps.map(e => (
            <button key={e.id} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>
              <DateBlock e={e} /><span style={{ minWidth: 0 }}><b>{e.name}</b><span className="s">{place(e)} · {dateLabel(e)}</span></span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{presence(e.id).flagged && <span className="tag red"><IcFlag s={11} />&nbsp;flagged</span>}<Tier e={e} /></span>
            </button>
          ))}</div> : <Blank title="No gaps" text="Every upcoming key event has someone from Bitcoin Suisse." />}
        </section>
        <section className="panel">
          <div className="panel-h"><div><h2 className="h2">Events per month</h2><p>Grey: events in the list. Red: with someone from Bitcoin Suisse.</p></div></div>
          <div className="mbar">{cols.map(m => {
            const es = inMonth(m), c = es.filter(e => presence(e.id).approved.length).length, sc = 150 / maxc;
            return (
              <div key={m} className="col" data-tip={h(`${ML[m % 12]} ${Math.floor(m / 12)}`) + `<br>${es.length} events · ${c} with Bitcoin Suisse`}>
                <span className="bx" style={{ height: es.length * sc }}><i className="c" style={{ height: '100%' }} />{c > 0 && <i className="a" style={{ height: c * sc }} />}</span>
                <span className="v">{es.length}</span>
              </div>
            );
          })}</div>
          <div className="mlabs">{cols.map(m => <span key={m}>{MS[m % 12]}{m % 12 === 0 || m === cur ? <><br />{String(Math.floor(m / 12)).slice(2)}</> : null}</span>)}</div>
          <h3 className="h3" style={{ marginTop: 24, marginBottom: 10 }}>Coverage by region <span className="dim small" style={{ fontWeight: 400 }}>· Tier 1–3 ahead</span></h3>
          <div className="hbars">{regs.map(([rg, c, t]) => <div key={rg} className="hbar" data-tip={`${h(REGION_LABEL[rg])}: ${c} of ${t} with someone`}><span>{REGION_LABEL[rg]}</span><span className="track"><i style={{ width: `${t ? c / t * 100 : 0}%` }} /></span><b>{c} / {t}</b></div>)}</div>
        </section>
      </div>

      <section className="sect">
        <h2 className="h2">Results per event</h2><p className="lede">Leads, cost per lead and “would go again” from the 60-second debriefs. This replaces the yearly rating round for the 2028 tiers.</p>
        <div className="card scroll-x">{results.length ? (
          <table className="tbl">
            <thead><tr><th>Event</th><th>Tier</th><th>Who</th><th className="r">Ticket</th><th className="r">Leads</th><th className="r">Per lead</th><th>Rating</th><th>Again?</th></tr></thead>
            <tbody>{results.map(r => {
              const e = ev.get(r.eventId)!, cpl = r.rating && r.leads ? Number(r.cost || 0) / r.leads : null;
              return (
                <tr key={r.id} className="click" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>
                  <td><div className="ev"><DateBlock e={e} /><div><b>{e.name}</b><span>{dateLabel(e)}</span></div></div></td>
                  <td><Tier e={e} /></td>
                  <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Av p={people.get(r.personId)} size="sm" /><span className="nowrap">{people.get(r.personId)?.name}</span></div></td>
                  <td className="r">{r.cost ? chf(r.cost) : <span className="dim">free</span>}</td>
                  <td className="r">{r.rating ? <b>{r.leads}</b> : <span className="pill red">debrief due</span>}</td>
                  <td className="r">{cpl != null ? chf(cpl) : <span className="dim">–</span>}</td>
                  <td>{r.rating ? <span className="dots5">{'●'.repeat(r.rating)}<em>{'●'.repeat(5 - r.rating)}</em></span> : null}</td>
                  <td>{r.goAgain && <span className={`pill ${r.goAgain === 'yes' ? 'ok' : r.goAgain === 'no' ? 'red' : ''}`}>{r.goAgain}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>) : <Blank icon={<IcChart s={22} />} title="No results yet" text="After the first events, each person does a 60-second debrief: leads assigned in HubSpot, rating and whether to go again. The results show up here per event." />}</div>
      </section>

      <div className="callout"><IcInfo /><span><b style={{ color: 'var(--ink)' }}>Next step: HubSpot.</b> When Roman approves, the event can be created in HubSpot automatically, and leads, deals and new clients flow back per event. Then conversion per event is measured, not typed in.</span></div>
    </main>
  );
}
