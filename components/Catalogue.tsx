'use client';
// The event catalogue for the events team: every event, edit, add, archive.
import { useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Tier, DateBlock } from './ui';
import { IcPlus, IcSearch, IcEdit } from './icons';
import { isStaff, place, dateLabel } from '@/lib/model';

export default function Catalogue() {
  const { me, events, open, presence } = useApp();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('');
  const [src, setSrc] = useState('');
  const [arch, setArch] = useState(false);
  const [past, setPast] = useState(true);
  const list = useMemo(() => {
    const qs = q.toLowerCase().split(/\s+/).filter(Boolean);
    return events.filter(e => (arch ? e.archived : !e.archived) && (past || !e.past) && (!tier || String(e.tk) === tier) && (!src || e.source === src) && qs.every(x => e.hay.includes(x)))
      .sort((a, b) => (a.sd ? +a.sd : 9e15) - (b.sd ? +b.sd : 9e15));
  }, [events, q, tier, src, arch, past]);
  if (!isStaff(me.role)) return <main className="page"><h1 className="title">Catalogue</h1><p className="muted" style={{ marginTop: 12 }}>Only the events team and admins edit the catalogue.</p></main>;
  const counts = { masterlist: events.filter(e => e.source === 'masterlist').length, manual: events.filter(e => e.source === 'manual').length, suggestion: events.filter(e => e.source === 'suggestion').length };
  return (
    <main className="page">
      <section className="head">
        <div><p className="k">Events team</p><h1 className="title">The <em>catalogue</em>.</h1><p className="lede">Every external event sales can request. Started from the 2026/27 masterlist; add, edit and archive here. Changes are live for everyone.</p></div>
        <div className="stats">
          <div className="stat"><b className="num">{counts.masterlist}</b><span>from the masterlist</span></div>
          <div className="stat"><b className="num">{counts.manual + counts.suggestion}</b><span>added here</span></div>
          <div className="stat"><b className="num">{events.filter(e => e.archived).length}</b><span>archived</span></div>
        </div>
      </section>
      <div className="toolbar">
        <label className="search"><IcSearch /><input className="input" type="search" placeholder="Search the catalogue…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" /></label>
        <select className="select sm" style={{ width: 140 }} value={tier} onChange={e => setTier(e.target.value)} aria-label="Tier"><option value="">All tiers</option>{[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>Tier {t}</option>)}<option value="0">Unrated</option></select>
        <select className="select sm" style={{ width: 170 }} value={src} onChange={e => setSrc(e.target.value)} aria-label="Source"><option value="">All sources</option><option value="masterlist">Masterlist</option><option value="manual">Added here</option><option value="suggestion">From suggestions</option></select>
        <button className="chip" aria-pressed={past} onClick={() => setPast(p => !p)}>Incl. past</button>
        <button className="chip" aria-pressed={arch} onClick={() => setArch(a => !a)}>Archived</button>
        <span style={{ flex: 1 }} />
        <button className="btn red" onClick={() => open({ kind: 'edit', id: null })}><IcPlus />Add event</button>
      </div>
      <p className="count-line"><b>{list.length} events</b></p>
      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th>Event</th><th>Tier</th><th>Type</th><th>Size</th><th>Bitcoin Suisse</th><th>Source</th><th /></tr></thead>
          <tbody>{list.map(e => {
            const p = presence(e.id);
            return (
              <tr key={e.id} className="click" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>
                <td><div className="ev"><DateBlock e={e} /><div style={{ minWidth: 0 }}><b>{e.name}</b><span>{place(e)}{e.mode !== 'exact' ? ` · ${dateLabel(e)}` : ''}</span></div></div></td>
                <td><Tier e={e} /></td>
                <td className="dim" style={{ maxWidth: 200 }}>{e.kind || '–'}</td>
                <td className="dim">{e.size || '–'}</td>
                <td className="nowrap">{p.approved.length ? <span className="pill ok">{p.approved.length} going</span> : p.requested.length ? <span className="pill wait">{p.requested.length} waiting</span> : <span className="dim">–</span>}</td>
                <td className="dim nowrap">{e.source === 'masterlist' ? 'Masterlist' : e.source === 'manual' ? 'Added here' : 'Suggestion'}</td>
                <td className="r" onClick={x => x.stopPropagation()}><button className="btn line sm" onClick={() => open({ kind: 'edit', id: e.id })}><IcEdit s={13} />Edit</button></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!list.length && <div className="empty">Nothing found.</div>}
      </div>
    </main>
  );
}
