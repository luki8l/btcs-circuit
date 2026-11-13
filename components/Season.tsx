'use client';
// The season map: every event as a dot. Lane = tier, x = date, size = audience; rings show Bitcoin Suisse presence.
import { useMemo } from 'react';
import { useApp, h } from './AppProvider';
import { MS, POLICY, SIZE_R, dateLabel, place, mIdx, dim, type Ev } from '@/lib/model';

// integer hash: the same on the server and in every browser (no float drift between renders)
const hash = (n: number) => (Math.imul(n ^ 0x5bd1e995, 2654435761) >>> 0) / 4294967296;
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function Season({ events, hit, from, to, big }: { events: Ev[]; hit: Set<number>; from: number; to: number; big?: boolean }) {
  const { presence, open, today, flagged } = useApp();
  const L = useMemo(() => {
    const months: number[] = []; for (let i = from; i <= to; i++) months.push(i);
    const pool = events.filter(e => e.mode === 'tbd' || !e.sd ? true : mIdx(e.sd) <= to && mIdx(e.endCheck || e.sd) >= from);
    const hasTbd = pool.some(e => e.mode === 'tbd' || !e.sd);
    const W = big ? 1700 : 1240, padL = 112, padR = 10, tbdW = hasTbd ? 78 : 0, top = 44;
    const mW = (W - padL - padR - tbdW) / Math.max(1, months.length);
    const k = big ? 1.25 : 1;
    const X = (e: Ev) => {
      if (e.mode === 'tbd' || !e.sd) return W - padR - tbdW + 14 + hash(e.id) * (tbdW - 28);
      let mi = mIdx(e.sd) - from, fr: number;
      if (e.mode === 'month') fr = .1 + hash(e.id) * .8; else fr = (e.sd.getDate() - .5) / dim(e.sd);
      if (mi < 0) { mi = 0; fr = .02; }
      return padL + (mi + fr) * mW;
    };
    const lanes: { t: number; y: number; h: number; n: number; items: { e: Ev; x: number; r: number; y: number }[] }[] = [];
    let y = top;
    for (const t of [1, 2, 3, 4, 5, 0]) {
      const items = pool.filter(e => e.tk === t).map(e => ({ e, x: X(e), r: (SIZE_R[e.size || ''] || 4.2) * k, y: 0 })).sort((a, b) => a.x - b.x);
      const placed: typeof items = [], gap = 1.8;
      for (const it of items) {
        const near = placed.filter(p => Math.abs(p.x - it.x) < p.r + it.r + gap);
        const c = [0];
        for (const p of near) { const R = p.r + it.r + gap; const dy = Math.sqrt(Math.max(0, R * R - (p.x - it.x) ** 2)); c.push(p.y + dy + .01, p.y - dy - .01); }
        c.sort((a, b) => Math.abs(a) - Math.abs(b));
        for (const cy of c) if (near.every(p => { const R = p.r + it.r + gap; return (p.x - it.x) ** 2 + (p.y - cy) ** 2 >= R * R - .02; })) { it.y = cy; break; }
        placed.push(it);
      }
      const ext = placed.reduce((m, p) => Math.max(m, Math.abs(p.y) + p.r), 0);
      const hh = Math.max(big ? 64 : 48, ext * 2 + 20);
      lanes.push({ t, y, h: hh, n: items.length, items: placed });
      y += hh;
    }
    const perMonth = months.map(m => pool.filter(e => e.sd && e.mode !== 'tbd' && mIdx(e.sd) === m && hit.has(e.id)).length);
    return { W, H: y + 8, padL, padR, tbdW, top, months, mW, lanes, perMonth, hasTbd };
  }, [events, from, to, big, hit]);

  const ti = mIdx(today) - from;
  const tx = ti >= 0 && ti < L.months.length ? r1(L.padL + (ti + (today.getDate() - .5) / dim(today)) * L.mW) : null;
  return (
    <div className="season-wrap">
      <svg className="season" viewBox={`0 0 ${L.W} ${r1(L.H)}`} role="img" aria-label="Events by tier and month" style={big ? { minWidth: 1100 } : undefined}>
        {L.lanes.map((ln, i) => (
          <g key={ln.t}>
            {i % 2 === 0 && <rect className="band" x={0} y={r1(ln.y)} width={L.W} height={r1(ln.h)} />}
            <text className="tl" x={14} y={r1(ln.y + ln.h / 2 - 2)}>{ln.t ? `Tier ${ln.t}` : 'Not rated'}</text>
            <text className="ts" x={14} y={r1(ln.y + ln.h / 2 + 13)}>{ln.t ? `${POLICY[ln.t][0]} · ${ln.n}` : `${ln.n} events`}</text>
          </g>
        ))}
        {L.months.map((m, i) => {
          const x = r1(L.padL + i * L.mW);
          return (
            <g key={m}>
              <line className="grid" x1={x} x2={x} y1={L.top - 30} y2={L.H} />
              <text className="mlab" x={x + 8} y={L.top - 20}>{MS[m % 12].toUpperCase()}{(m % 12 === 0 || i === 0) && <tspan className="ylab" dx={5}>{Math.floor(m / 12)}</tspan>}</text>
              <text className="mcnt" x={x + 8} y={L.top - 7}>{L.perMonth[i]} event{L.perMonth[i] === 1 ? '' : 's'}</text>
            </g>
          );
        })}
        {L.hasTbd && <g><line className="grid" x1={L.W - L.padR - L.tbdW} x2={L.W - L.padR - L.tbdW} y1={L.top - 30} y2={L.H} /><text className="mlab" x={L.W - L.padR - L.tbdW + 8} y={L.top - 20}>TBD</text></g>}
        {tx != null && <g><line className="today" x1={tx} x2={tx} y1={L.top - 2} y2={L.H} /><text className="today-l" x={tx + 5} y={L.H - 8}>TODAY</text></g>}
        {L.lanes.map(ln => ln.items.map(it => {
          const e = it.e, cy = r1(ln.y + ln.h / 2 + it.y), cx = r1(it.x), pr = presence(e.id);
          const on = hit.has(e.id);
          const ring = pr.approved.length ? 'ring' : pr.requested.length ? 'ring req' : flagged.has(e.id) ? 'ring flag' : null;
          const tip = `<b>${h(e.name)}</b>${h(dateLabel(e))} · ${h(place(e))}<br>${e.tk ? 'Tier ' + e.tk : 'Unrated'}${pr.approved.length ? ` · ${pr.approved.length} going` : ''}${pr.requested.length ? ` · ${pr.requested.length} waiting` : ''}${pr.flagged ? ' · flagged' : ''}`;
          return (
            <g key={e.id} className={`dot ${on ? '' : 'dim'} ${e.past ? 'past' : ''}`} data-tip={tip} tabIndex={on ? 0 : -1} role="button" aria-label={e.name}
              onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })} onKeyDown={x => { if (x.key === 'Enter' || x.key === ' ') { x.preventDefault(); open({ kind: 'event', id: e.id, view: 'detail' }); } }}>
              <circle className="hit" cx={cx} cy={cy} r={r1(it.r + 4)} />
              {ring && <circle className={ring} cx={cx} cy={cy} r={r1(it.r + 3)} />}
              <circle className={`m f${e.tk}`} cx={cx} cy={cy} r={r1(it.r)} />
            </g>
          );
        }))}
      </svg>
    </div>
  );
}
