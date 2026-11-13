'use client';
// "By team and person" on the Overview: teams that open into their people, people that open into their events.
// Or one flat list of everyone, best first. Same numbers as the PDF and Excel (lib/report).
import { Fragment, useState } from 'react';
import { useApp } from './AppProvider';
import { Av } from './ui';
import { IcChevDown } from './icons';
import { chf, MS, type Ev } from '@/lib/model';
import type { PersonRow, Report, Tally, Row } from '@/lib/report';

const dash = <span className="dim">–</span>;
const Dots = ({ v }: { v: number | null }) => v == null ? dash : <span className="dots5" data-tip={`${v.toFixed(1)} / 5`}>{'●'.repeat(Math.round(v))}<em>{'●'.repeat(5 - Math.round(v))}</em></span>;
const when = (e: Ev) => e.mode === 'tbd' || !e.sd ? 'TBD' : `${e.mode === 'exact' ? e.sd.getDate() + ' ' : ''}${MS[e.sd.getMonth()]} ${String(e.sd.getFullYear()).slice(2)}`;

function Cells({ x }: { x: Tally }) {
  return <>
    <td className="r">{x.ahead || dash}</td>
    <td className="r">{x.waiting || dash}</td>
    <td className="r">{x.went ? <>{x.went}{x.due > 0 && <span className="pill red" style={{ marginLeft: 8 }} data-tip="Events that happened, debrief not done yet">{x.due} due</span>}</> : dash}</td>
    <td className="r"><b>{x.leads || dash}</b></td>
    <td className="r">{x.perEvent != null ? x.perEvent.toFixed(1) : dash}</td>
    <td><Dots v={x.rating} /></td>
    <td className="r">{x.spend ? chf(x.spend) : dash}</td>
  </>;
}

/** a person's events: what came back, what's coming, what's waiting */
function Trips({ p }: { p: PersonRow }) {
  const { open, today } = useApp();
  const started = (x: Row) => x.e.past || (!!x.e.sd && x.e.mode !== 'tbd' && x.e.sd <= today);
  const done = p.rows.filter(x => x.r.status === 'approved' && started(x)), ahead = p.rows.filter(x => x.r.status === 'approved' && !started(x)), wait = p.rows.filter(x => x.r.status === 'requested');
  const chip = (x: Row, extra: string, cls = '') => <button key={x.r.id} className={`trip ${cls}`} onClick={() => open({ kind: 'event', id: x.e.id, view: 'detail' })}><b>{x.e.name}</b><span>{when(x.e)}{extra ? ` · ${extra}` : ''}</span></button>;
  if (!p.rows.length) return <p className="dim small">No requests yet.</p>;
  return (
    <div className="trips">
      {done.length > 0 && <div><p className="lab">Done</p>{done.map(x => chip(x, x.r.rating ? `${x.r.leads} lead${x.r.leads === 1 ? '' : 's'} · ${x.r.rating}/5` : 'debrief due', x.r.rating ? '' : 'due'))}</div>}
      {ahead.length > 0 && <div><p className="lab">Coming up</p>{ahead.map(x => chip(x, x.r.ticket === 'paid' && x.r.cost ? chf(x.r.cost) : ''))}</div>}
      {wait.length > 0 && <div><p className="lab">Waiting for Roman</p>{wait.map(x => chip(x, '', 'wait'))}</div>}
    </div>
  );
}

export default function TeamBreakdown({ R }: { R: Report }) {
  const { people } = useApp();
  const [view, setView] = useState<'team' | 'person'>('team');
  const [openT, setOpenT] = useState<Set<string>>(new Set());
  const [openP, setOpenP] = useState<string | null>(null);
  const toggleT = (t: string) => setOpenT(s => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const all = openT.size === R.teams.length;
  const head = <tr><th>{view === 'team' ? 'Team / person' : 'Person'}</th><th className={view === 'team' ? 'r' : ''}>{view === 'team' ? 'Sales' : 'Team'}</th><th className="r">Trips ahead</th><th className="r">Waiting</th><th className="r">Events done</th><th className="r">Leads</th><th className="r" data-tip="Leads per debriefed event">Leads / event</th><th>Avg. rating</th><th className="r">Ticket budget</th></tr>;
  const person = (p: PersonRow, nested: boolean) => (
    <Fragment key={p.id}>
      <tr className={`click ${nested ? 'sub' : ''} ${openP === p.id ? 'sel' : ''}`} onClick={() => setOpenP(x => x === p.id ? null : p.id)} aria-expanded={openP === p.id}>
        <td><div className="who-c"><IcChevDown s={13} className={`chev ${openP === p.id ? 'on' : ''}`} /><Av p={people.get(p.id)} size="sm" /><div><b>{p.name}</b><small>{[p.market, !p.active && 'inactive'].filter(Boolean).join(' · ')}</small></div></div></td>
        <td className={nested ? 'r' : 'dim'}>{nested ? '' : p.team}</td>
        <Cells x={p} />
      </tr>
      {openP === p.id && <tr className="detail trips-row"><td colSpan={9}><Trips p={p} /></td></tr>}
    </Fragment>
  );
  return (
    <section className="sect" id="by-team">
      <div className="sect-h">
        <div><h2 className="h2">By team and person</h2><p className="lede">Trips, results and budget. Click a team to see its people, click a person to see their events.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {view === 'team' && <button className="btn ghost sm" onClick={() => setOpenT(all ? new Set() : new Set(R.teams.map(t => t.t)))}>{all ? 'Collapse all' : 'Show everyone'}</button>}
          <div className="seg" role="group" aria-label="Breakdown"><button aria-pressed={view === 'team'} onClick={() => setView('team')}>By team</button><button aria-pressed={view === 'person'} onClick={() => setView('person')}>By person</button></div>
        </div>
      </div>
      <div className="card scroll-x"><table className="tbl breakdown">
        <thead>{head}</thead>
        <tbody>
          {view === 'team' ? R.teams.map(t => (
            <Fragment key={t.t}>
              <tr className="click team" onClick={() => toggleT(t.t)} aria-expanded={openT.has(t.t)}>
                <td><div className="who-c"><IcChevDown s={13} className={`chev ${openT.has(t.t) ? 'on' : ''}`} /><b>{t.t}</b><small className="dim">{t.members.length} {t.members.length === 1 ? 'person' : 'people'}</small></div></td>
                <td className="r">{t.people || dash}</td>
                <Cells x={t} />
              </tr>
              {openT.has(t.t) && t.members.map(p => person(p, true))}
            </Fragment>
          )) : R.persons.map(p => person(p, false))}
        </tbody>
      </table></div>
    </section>
  );
}
