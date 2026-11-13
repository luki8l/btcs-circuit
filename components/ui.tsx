'use client';
import { useState, useEffect, useRef } from 'react';
import { MS, GS, POLICY, type Ev, type Req, type Person } from '@/lib/model';
import { IcChevDown } from './icons';

export function Tier({ e, full }: { e: { tk: number }; full?: boolean }) {
  const label = e.tk ? `Tier ${e.tk}` : 'Not rated';
  return <span className={`tier t${e.tk}`} title={e.tk ? `Tier ${e.tk}: ${POLICY[e.tk][0]}` : 'Not rated in the 2027 round'}><i />{full && e.tk ? `${label} · ${POLICY[e.tk][0]}` : label}</span>;
}
export function DateBlock({ e }: { e: Ev }) {
  if (e.mode === 'tbd' || !e.sd) return <div className="dt tbc"><b>TBD</b><span>date</span></div>;
  const s = e.sd, t = e.ed || s, yy = String(s.getFullYear()).slice(2);
  if (e.mode === 'month') return <div className="dt tbc"><b>{MS[s.getMonth()]}</b><span>{s.getFullYear()}</span></div>;
  const p = (n: number) => String(n);
  const d = +s === +t ? p(s.getDate()) : s.getMonth() === t.getMonth() ? `${p(s.getDate())}–${p(t.getDate())}` : `${p(s.getDate())}+`;
  return <div className="dt"><b>{d}</b><span>{MS[s.getMonth()]} {yy}</span></div>;
}
export function Av({ p, req, size }: { p?: Person; req?: boolean; size?: 'sm' | 'lg' }) {
  return <span className={`av ${req ? 'req' : ''} ${size || ''}`} title={p ? `${p.name}${p.market ? ' · ' + p.market : ''}` : ''}>{p?.initials || '?'}</span>;
}
export function StatusPill({ r, past }: { r: Req; past?: boolean }) {
  if (r.status === 'requested') return <span className="pill wait"><i />Waiting for approval</span>;
  if (r.status === 'declined') return <span className="pill off">Declined</span>;
  if (r.status === 'withdrawn') return <span className="pill off">Withdrawn</span>;
  if (r.rating) return <span className="pill">Done</span>;
  if (past) return <span className="pill red"><i />Debrief due</span>;
  return <span className="pill ok"><i />Approved</span>;
}
export function FitMini({ e, g }: { e: Ev; g: number }) {
  if (e.fit.every(x => x == null)) return null;
  return <span className="dim small">{GS[g]} fit {e.fit[g] ?? '–'}/5</span>;
}
export const Logo = ({ h = 30 }: { h?: number }) => <img src="/logo-dark.png" alt="Bitcoin Suisse" style={{ height: h, width: 'auto', display: 'block' }} />;

/** a button that asks once more inline (no browser dialogs) */
export function Confirm({ label, sure, onYes, className = 'btn ghost sm', disabled }: { label: React.ReactNode; sure: string; onYes: () => void; className?: string; disabled?: boolean }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 4000); return () => clearTimeout(t); }, [ask]);
  return ask
    ? <button className="btn red sm" disabled={disabled} onClick={() => { setAsk(false); onYes(); }}>{sure}</button>
    : <button className={className} disabled={disabled} onClick={() => setAsk(true)}>{label}</button>;
}

/** dropdown with a button label; closes on outside click and Escape */
export function Dropdown({ label, value, active, children, right }: { label: string; value?: string; active?: boolean; children: (close: () => void) => React.ReactNode; right?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', c); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', c); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className="dd" ref={ref}>
      <button type="button" className={active ? 'on' : ''} aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}{value && <span className="v">{value}</span>}<IcChevDown s={14} /></button>
      {open && <div className={`dd-panel ${right ? 'right' : ''}`} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** empty state with a clear next step */
export function Blank({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="blank">{icon && <div className="ic">{icon}</div>}<b>{title}</b><p>{text}</p>{action}</div>;
}
