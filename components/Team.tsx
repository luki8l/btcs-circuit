'use client';
// Who goes where: people × months. Approved solid, waiting dashed. The coordination view for everyone.
import { useMemo, useState } from 'react';
import { useApp, h } from './AppProvider';
import Link from 'next/link';
import { Blank } from './ui';
import { IcUsers } from './icons';
import { MS, ML, ROLE_LABEL, mIdx, dateLabel, place, type Req } from '@/lib/model';

export default function Team() {
  const { data, ev, people, open, today, me } = useApp();
  const [back, setBack] = useState(0);
  const [team, setTeam] = useState('');
  const [onlyBusy, setOnlyBusy] = useState(false);
  const start = mIdx(today) - back, months = Array.from({ length: 9 + back }, (_, i) => start + i);
  const reqs = data.requests.filter(r => r.status === 'approved' || r.status === 'requested');
  const byPerson = useMemo(() => {
    const m = new Map<string, Req[]>(); for (const r of reqs) { const a = m.get(r.personId) || []; a.push(r); m.set(r.personId, a); } return m;
  }, [reqs]);
  // shown: sales and Roman (approver, under his team "Management") always; anyone else only when they travel themselves
  const shown = (p: { id: string; role: string; active: boolean }) => p.active && (p.role === 'sales' || p.role === 'events' || byPerson.has(p.id));
  const teams = [...new Set(data.people.filter(shown).map(p => p.team || '—'))].sort();
  const list = data.people.filter(p => shown(p) && (!team || (p.team || '—') === team) && (!onlyBusy || (byPerson.get(p.id) || []).length))
    .sort((a, b) => (a.team || 'zz').localeCompare(b.team || 'zz') || a.name.localeCompare(b.name));
  const groups = new Map<string, typeof list>(); list.forEach(p => { const k = p.team || 'No team'; groups.set(k, [...(groups.get(k) || []), p]); });
  const cur = mIdx(today);
  const cell = (pid: string, m: number) => (byPerson.get(pid) || []).filter(r => { const e = ev.get(r.eventId); return e && e.sd && e.mode !== 'tbd' && mIdx(e.sd) === m; })
    .sort((a, b) => +ev.get(a.eventId)!.sd! - +ev.get(b.eventId)!.sd!);
  const later = (pid: string) => (byPerson.get(pid) || []).filter(r => { const e = ev.get(r.eventId); return e && (e.mode === 'tbd' || !e.sd || mIdx(e.sd) > months[months.length - 1]); });
  const load = (pid: string) => (byPerson.get(pid) || []).filter(r => r.status === 'approved' && ev.get(r.eventId) && !ev.get(r.eventId)!.past).length;
  const pill = (r: Req) => {
    const e = ev.get(r.eventId)!;
    return <button key={r.id} className={`mx t${e.tk} ${r.status === 'requested' ? 'req' : ''}`} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}
      data-tip={`<b>${h(e.name)}</b>${h(dateLabel(e))} · ${h(place(e))}<br>${r.status === 'approved' ? 'Approved' : 'Waiting for approval'}`}>{e.name}</button>;
  };
  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">Who goes where</h1><p className="lede">Everyone’s events by month, so we split the floor and avoid double trips. Solid = approved, dashed = waiting for Roman.</p></div>
        <div className="stats">
          <div className="stat"><b className="num">{new Set(reqs.filter(r => r.status === 'approved' && !ev.get(r.eventId)?.past).map(r => r.personId)).size}</b><span>people on the road</span></div>
          <div className="stat"><b className="num">{reqs.filter(r => r.status === 'approved' && !ev.get(r.eventId)?.past).length}</b><span>approved trips ahead</span></div>
        </div>
      </section>
      <div className="toolbar">
        <select className="select sm" style={{ width: 200 }} value={team} onChange={e => setTeam(e.target.value)} aria-label="Team"><option value="">All teams</option>{teams.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <button className="chip" aria-pressed={onlyBusy} onClick={() => setOnlyBusy(b => !b)}>Only people with events</button>
        <span style={{ flex: 1 }} />
        <div className="seg"><button aria-pressed={back === 0} onClick={() => setBack(0)}>From now</button><button aria-pressed={back === 3} onClick={() => setBack(3)}>Incl. last 3 months</button></div>
      </div>
      {!reqs.length && <div className="card" style={{ marginBottom: 14 }}><Blank icon={<IcUsers s={22} />} title="Nobody is booked yet" text="As soon as colleagues request events, they show up here by person and month." action={<Link className="btn red" href="/discover">Browse events</Link>} /></div>}
      <div className="matrix">
        <table>
          <colgroup><col className="c-who" /><col className="c-load" />{months.map(m => <col key={m} />)}<col /></colgroup>
          <thead><tr><th>Person</th><th style={{ textAlign: 'right' }}>Ahead</th>{months.map(m => <th key={m} className={m === cur ? 'cur' : ''}>{MS[m % 12]} {String(Math.floor(m / 12)).slice(2)}</th>)}<th>Later / TBD</th></tr></thead>
          <tbody>
            {[...groups.entries()].map(([g, ps]) => [
              <tr key={'g' + g} className="team"><td colSpan={months.length + 3}>{g}</td></tr>,
              ...ps.map(p => (
                <tr key={p.id}>
                  <td className="who"><b>{p.name}{p.id === me.id ? ' (you)' : ''}</b><small>{[p.market, ROLE_LABEL[p.role]].filter(Boolean).join(' · ')}</small></td>
                  <td style={{ textAlign: 'right' }}><span className="load">{load(p.id) || <span className="dim">–</span>}</span></td>
                  {months.map(m => <td key={m}>{cell(p.id, m).map(pill)}</td>)}
                  <td>{later(p.id).map(pill)}</td>
                </tr>
              )),
            ])}
            {!list.length && <tr><td colSpan={months.length + 3} className="empty">No one here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="foot">Months show events with a date or a known month. {ML[cur % 12]} is highlighted. Click any event for details.</p>
    </main>
  );
}
