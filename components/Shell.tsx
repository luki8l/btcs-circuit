'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Tier, Logo } from './ui';
import { IcSearch, IcChevDown, IcHelp } from './icons';
import { dateLabel, place, ROLE_LABEL, type Role } from '@/lib/model';
import Drawer from './Drawer';
import Tour, { TourOffer } from './Tour';

const NAV: Record<Role, string[]> = {
  sales: ['discover', 'my', 'team'],
  events: ['approvals', 'insights', 'discover', 'team', 'catalogue'],   // Roman: decides, and is the CEO who reads the Overview
  management: ['insights', 'discover', 'approvals', 'team'],
  admin: ['approvals', 'insights', 'discover', 'team', 'catalogue', 'people'],
};
const LABEL: Record<string, string> = { discover: 'Events', my: 'My events', approvals: 'Requests', team: 'Team', catalogue: 'Catalogue', insights: 'Overview', people: 'People' };

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, data, palette, setPalette, ev, today, isNew } = useApp();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  // walkthrough: top-bar button, user menu, ?tour=1, a 'circuit:tour' event, and a one-time offer on the first visit
  const [tour, setTour] = useState(false);
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    const start = () => { setOffer(false); setTour(true); };
    window.addEventListener('circuit:tour', start);
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('tour')) { u.searchParams.delete('tour'); history.replaceState(history.state, '', u); start(); }
      else if (!localStorage.getItem('circuit.tour.' + me.id)) t = setTimeout(() => setOffer(true), 900);
    } catch { /* storage off: no offer */ }
    return () => { window.removeEventListener('circuit:tour', start); if (t) clearTimeout(t); };
  }, [me.id]);
  const later = () => { setOffer(false); try { localStorage.setItem('circuit.tour.' + me.id, 'later'); } catch { /* storage off */ } };
  const waiting = data.requests.filter(r => r.status === 'requested').length;
  // Roman (and admins) also get new event suggestions to review; read-only accounts only see open requests
  const pending = waiting + (me.role === 'management' ? 0 : data.suggestions.filter(s => s.status === 'pending').length);
  // My events: steps left (HubSpot, debrief) plus decisions not seen yet
  const started = (id: number) => { const e = ev.get(id); return !!e && !!e.sd && e.mode !== 'tbd' && e.sd <= today; };
  const mine = data.requests.filter(r => r.personId === me.id);
  const steps = mine.filter(r => r.status === 'approved' && !r.rating && (!r.hubspot || started(r.eventId))).length;
  const unseen = mine.filter(r => isNew(r) && !(r.status === 'approved' && !r.rating && (!r.hubspot || started(r.eventId)))).length;
  const todo = steps + unseen;
  useEffect(() => { if (!menu) return; const c = () => setMenu(false); setTimeout(() => document.addEventListener('click', c, { once: true }), 0); return () => document.removeEventListener('click', c); }, [menu]);
  async function signOut() { await fetch('/auth/signout', { method: 'POST' }); location.assign('/login'); }
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link href="/" className="brand" aria-label="Circuit home"><Logo /><i /><b>Circuit</b></Link>
          <nav className="nav" aria-label="Main">
            {NAV[me.role].map(k => (
              <Link key={k} href={`/${k}`} aria-current={path.startsWith(`/${k}`) ? 'page' : undefined}>
                {LABEL[k]}{k === 'approvals' && pending > 0 && <span className="cnt" title={`${waiting} request${waiting === 1 ? '' : 's'} waiting for a decision`}>{pending}</span>}{k === 'my' && todo > 0 && <span className="cnt" title={[steps ? `${steps} with steps left` : '', unseen ? `${unseen} new decision${unseen > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}>{todo}</span>}
              </Link>
            ))}
          </nav>
          <div className="top-r">
            <button className="tour-btn" onClick={() => { setOffer(false); setTour(true); }} aria-label="Walkthrough" title="A one-minute walkthrough of Circuit"><IcHelp s={17} /><span>Walkthrough</span></button>
            <button className="kbtn" onClick={() => setPalette(true)} aria-label="Find an event"><IcSearch /><span>Find an event</span><kbd>⌘K</kbd></button>
            <div className="me">
              <button onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-haspopup="menu">
                <span className="av">{me.initials}</span>
                <span className="who"><b>{me.name}</b><span>{ROLE_LABEL[me.role]}{me.market ? ` · ${me.market}` : ''}</span></span>
                <IcChevDown s={14} />
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <p><b>{me.name}</b>{me.email}<br />{ROLE_LABEL[me.role]}{me.team ? ` · ${me.team}` : ''}</p>
                  <Link href="/my" role="menuitem">My events</Link>
                  <Link href="/discover" role="menuitem">All events</Link>
                  <button role="menuitem" onClick={() => setTour(true)}>Walkthrough</button>
                  <button role="menuitem" onClick={signOut}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {children}
      <Drawer />
      {palette && <Palette onClose={() => setPalette(false)} />}
      {tour && <Tour onClose={() => setTour(false)} />}
      {offer && !tour && <TourOffer onStart={() => { setOffer(false); setTour(true); }} onLater={later} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { events, open, me, presence } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const pages = NAV[me.role].map(k => ({ k, label: LABEL[k] }));
  const hits = useMemo(() => {
    const qs = q.toLowerCase().split(/\s+/).filter(Boolean);
    const evs = events.filter(e => !qs.length ? !e.past && (e.tk === 1 || e.tk === 2) : qs.every(x => e.hay.includes(x)))
      .sort((a, b) => Number(a.past) - Number(b.past) || (a.sd ? +a.sd : 9e15) - (b.sd ? +b.sd : 9e15)).slice(0, 9);
    const pg = qs.length ? pages.filter(p => qs.every(x => p.label.toLowerCase().includes(x))) : [];
    return [...pg.map(p => ({ type: 'page' as const, p })), ...evs.map(e => ({ type: 'ev' as const, e }))];
  }, [q, events]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setI(0), [q]);
  function go(n: number) {
    const h = hits[n]; if (!h) return;
    onClose();
    if (h.type === 'page') router.push(`/${h.p.k}`); else open({ kind: 'event', id: h.e.id, view: 'detail' });
  }
  return (
    <div className="pal-wrap" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-label="Jump to an event">
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Event, city, country or page…" aria-label="Search"
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, hits.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)); } else if (e.key === 'Enter') go(i); }} />
        {!q && <p className="ph lab">Upcoming Tier 1–2</p>}
        <ul role="listbox">
          {hits.map((h, n) => (
            <li key={h.type === 'page' ? 'p' + h.p.k : h.e.id}>
              <button role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(n)}>
                {h.type === 'page' ? <><span className="tag">Page</span><span className="t"><b>{h.p.label}</b></span></> : <>
                  <Tier e={h.e} />
                  <span className="t"><b>{h.e.name}</b><span>{dateLabel(h.e)} · {place(h.e)}{h.e.past ? ' · over' : ''}</span></span>
                  {presence(h.e.id).approved.length > 0 && <span className="pill ok">{presence(h.e.id).approved.length} going</span>}
                </>}
              </button>
            </li>
          ))}
          {!hits.length && <li className="empty">Nothing found.</li>}
        </ul>
      </div>
    </div>
  );
}
