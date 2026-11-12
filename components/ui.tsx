'use client';
import { useState as useS, useEffect as useE } from 'react';
import { MS, GS, type Ev, type Req, type Person } from '@/lib/model';

export function Tier({ e }: { e: { tk: number } }) {
  return <span className={`tier t${e.tk}`} title={e.tk ? `Tier ${e.tk} (2027 rating)` : 'Not rated yet'}>{e.tk ? `T${e.tk}` : '–'}</span>;
}
export function DateBlock({ e }: { e: Ev }) {
  if (e.mode === 'tbd' || !e.sd) return <div className="dt tbc"><b>TBD</b><span>date</span></div>;
  const s = e.sd, t = e.ed || s, yy = String(s.getFullYear()).slice(2);
  if (e.mode === 'month') return <div className="dt tbc"><b>TBC</b><span>{MS[s.getMonth()]} {yy}</span></div>;
  const p = (n: number) => String(n).padStart(2, '0');
  const d = +s === +t ? p(s.getDate()) : s.getMonth() === t.getMonth() ? `${p(s.getDate())}–${p(t.getDate())}` : `${p(s.getDate())}+`;
  return <div className="dt"><b>{d}</b><span>{MS[s.getMonth()]} {yy}</span></div>;
}
export function Av({ p, req, size }: { p?: Person; req?: boolean; size?: 'sm' | 'lg' }) {
  return <span className={`av ${req ? 'req' : ''} ${size || ''}`} title={p ? `${p.name}${p.market ? ' · ' + p.market : ''}` : ''}>{p?.initials || '?'}</span>;
}
export function StatusPill({ r, past }: { r: Req; past?: boolean }) {
  if (r.status === 'requested') return <span className="pill wait"><i />Waiting</span>;
  if (r.status === 'declined') return <span className="pill off">Declined</span>;
  if (r.status === 'withdrawn') return <span className="pill off">Withdrawn</span>;
  if (r.rating) return <span className="pill">Closed</span>;
  if (past) return <span className="pill red"><i />Debrief due</span>;
  return <span className="pill ok"><i />Approved</span>;
}
export function FitMini({ e, g }: { e: Ev; g: number }) {
  if (e.fit.every(x => x == null)) return <div className="fit"><small className="dim">Fit not rated</small></div>;
  const tip = '<b>Buy-side fit</b>' + GS.map((n, i) => `${n}: ${e.fit[i] ?? '–'}`).join('<br>');
  return (
    <div className="fit" data-tip={tip}>
      <div className="bars5">{e.fit.map((x, i) => <i key={i} className={i === g ? 'me' : ''} style={{ height: (x || 0) * 4 }} />)}</div>
      <div><b>{e.fit[g] ?? '–'}/5</b><small>{GS[g]}</small></div>
    </div>
  );
}
export const Logo = ({ h = 26 }: { h?: number }) => <img src="/logo.png" alt="Bitcoin Suisse" style={{ height: h, width: 'auto', display: 'block' }} />;

/** a button that asks once more inline (no browser dialogs) */
export function Confirm({ label, sure, onYes, className = 'btn ghost sm', disabled }: { label: React.ReactNode; sure: string; onYes: () => void; className?: string; disabled?: boolean }) {
  const [ask, setAsk] = useS(false);
  useE(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 4000); return () => clearTimeout(t); }, [ask]);
  return ask
    ? <button className="btn red sm" disabled={disabled} onClick={() => { setAsk(false); onYes(); }}>{sure}</button>
    : <button className={className} disabled={disabled} onClick={() => setAsk(true)}>{label}</button>;
}
