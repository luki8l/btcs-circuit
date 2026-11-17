'use client';
// Month calendar: events as bars across their days (like a team calendar); month-only events in the side column.
import { useMemo, useState } from 'react';
import { useApp, h } from './AppProvider';
import { Tier } from './ui';
import { IcBack, IcNext, IcFlag } from './icons';
import { ML, dateLabel, place, mIdx, type Ev } from '@/lib/model';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function Calendar({ events, month, setMonth, big, tools }: { events: Ev[]; month: number; setMonth: (m: number) => void; big?: boolean; tools?: React.ReactNode }) {
  const { open, presence, today, data } = useApp();
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set());
  const y = Math.floor(month / 12), m = month % 12;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const weeks = useMemo(() => {
    const out: { start: Date; days: Date[]; lanes: { e: Ev; s: number; t: number; lane: number }[]; nl: number }[] = [];
    for (let w = start; w <= last; w = addDays(w, 7)) {
      const end = addDays(w, 6), days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
      const evs = events.filter(e => e.mode === 'exact' && e.sd && e.ed && e.sd <= end && e.ed >= w)
        .sort((a, b) => +a.sd! - +b.sd! || (+b.ed! - +b.sd!) - (+a.ed! - +a.sd!) || a.tk - b.tk);
      const used: [number, number][][] = [], lanes: { e: Ev; s: number; t: number; lane: number }[] = [];
      for (const e of evs) {
        const s = Math.max(0, Math.round((+e.sd! - +w) / 864e5)), t = Math.min(6, Math.round((+e.ed! - +w) / 864e5));
        let lane = used.findIndex(l => l.every(([a, b]) => t < a || s > b));
        if (lane < 0) { lane = used.length; used.push([]); }
        used[lane].push([s, t]); lanes.push({ e, s, t, lane });
      }
      out.push({ start: w, days, lanes, nl: used.length });
    }
    return out;
  }, [events, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthOnly = events.filter(e => e.mode === 'month' && e.sd && mIdx(e.sd) === month);
  const exactCount = events.filter(e => e.mode === 'exact' && e.sd && e.ed && e.sd <= last && e.ed >= first).length;
  const MAX = big ? 6 : 4;
  const isToday = (d: Date) => +d === +today;
  return (
    <div className="cal">
      <div className="cal-h">
        <button className="icon" onClick={() => setMonth(month - 1)} aria-label="Previous month"><IcBack /></button>
        <button className="icon" onClick={() => setMonth(month + 1)} aria-label="Next month"><IcNext /></button>
        <h2 className="title">{ML[m]} <span className="dim">{y}</span></h2>
        <span className="dim small">{exactCount} with dates · {monthOnly.length} day TBC</span>
        <span className="sp" />
        <button className="btn sm" onClick={() => setMonth(mIdx(today))}>Today</button>
        {tools}
      </div>
      <CalendarLegend flags={data.flags.length > 0} />
      <div className="cal-body">
        <div className="cal-grid">
          <div className="cal-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
          {weeks.map((wk, wi) => {
            const all = openWeeks.has(wi), shown = all ? wk.nl : Math.min(wk.nl, MAX);
            const hiddenPerDay = wk.days.map((_, di) => wk.lanes.filter(l => l.lane >= shown && l.s <= di && l.t >= di).length);
            const rows = `26px repeat(${shown}, 24px) ${hiddenPerDay.some(Boolean) ? '22px' : ''} 1fr`;
            return (
              <div key={wi} className="cal-week" style={{ gridTemplateRows: rows, minHeight: big ? 150 : 116 }}>
                {wk.days.map((d, di) => (
                  <div key={di} className={`cal-day ${d.getMonth() !== m ? 'out' : ''} ${di >= 5 ? 'wknd' : ''} ${isToday(d) ? 'today' : ''}`} style={{ gridColumn: di + 1, gridRow: '1 / -1' }}><b>{d.getDate()}</b></div>
                ))}
                {wk.lanes.filter(l => l.lane < shown).map(l => {
                  const pr = presence(l.e.id);
                  return (
                    <button key={l.e.id} className={`cal-bar t${l.e.tk}`} style={{ gridColumn: `${l.s + 1} / ${l.t + 2}`, gridRow: l.lane + 2 }}
                      data-tip={`<b>${h(l.e.name)}</b>${h(dateLabel(l.e))} · ${h(place(l.e))}<br>${l.e.tk ? 'Tier ' + l.e.tk : 'Unrated'}${pr.approved.length ? ` · ${pr.approved.length} going` : ''}${pr.requested.length ? ` · ${pr.requested.length} waiting` : ''}${pr.flagged ? ' · flagged by Roman' : ''}`}
                      onClick={() => open({ kind: 'event', id: l.e.id, view: 'detail' })}>
                      {pr.flagged && !pr.approved.length && <IcFlag s={12} className="fl" />}<span>{l.e.name}</span>
                      {(pr.approved.length + pr.requested.length) > 0 && <span className="who">{pr.approved.slice(0, 3).map(r => <i key={r.id} />)}{pr.requested.slice(0, 2).map(r => <i key={r.id} className="req" />)}</span>}
                    </button>
                  );
                })}
                {hiddenPerDay.map((n, di) => n > 0 && (
                  <button key={'m' + di} className="cal-more" style={{ gridColumn: di + 1, gridRow: shown + 2 }} onClick={() => setOpenWeeks(s => new Set(s).add(wi))}>+{n}<span className="more-t"> more</span></button>
                ))}
                {all && wk.nl > MAX && <button className="cal-more" style={{ gridColumn: 7, gridRow: shown + 2, textAlign: 'right' }} onClick={() => setOpenWeeks(s => { const n = new Set(s); n.delete(wi); return n; })}>less</button>}
              </div>
            );
          })}
        </div>
        <aside className="cal-side">
          <h4>{ML[m]}, day not fixed yet</h4>
          {monthOnly.length ? monthOnly.sort((a, b) => a.tk - b.tk || a.name.localeCompare(b.name)).map(e => (
            <button key={e.id} className="side-ev" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>
              <Tier e={e} /><span>{e.name}</span>{presence(e.id).approved.length > 0 ? <i className="lg-ring" style={{ width: 10, height: 10 }} /> : presence(e.id).flagged && <IcFlag s={12} className="fl" />}
            </button>
          )) : <p className="dim small">None.</p>}
        </aside>
      </div>
    </div>
  );
}

/** what the marks in the calendar mean, drawn with the calendar's own styles */
export function CalendarLegend({ flags = true }: { flags?: boolean }) {
  return (
    <div className="legend sl cal-lg" role="list" aria-label="Legend">
      <div className="sl-g" role="listitem"><b>Tier</b>
        <span><i className="cal-bar lg t1" />1 · Key event</span><span><i className="cal-bar lg t2" />2 · Important</span><span><i className="cal-bar lg t3" />3 · Worth going</span>
        <span><i className="cal-bar lg t4" />4–5 · Low / skip</span><span><i className="cal-bar lg t0" />Not rated</span>
      </div>
      <div className="sl-g" role="listitem"><b>Bitcoin Suisse</b>
        <span><i className="cal-dot" />Someone approved (one dot each)</span><span><i className="cal-dot req" />Request waiting</span>
        {flags && <span><IcFlag s={12} className="fl" />Flagged by Roman</span>}
      </div>
      <div className="sl-g" role="listitem"><b>Days</b>
        <span><i className="cal-today">13</i>Today</span><span><i className="cal-side-ic" />Side list: month known, day not fixed yet</span>
      </div>
    </div>
  );
}
