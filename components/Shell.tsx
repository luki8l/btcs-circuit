'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Tier, Logo } from './ui';
import { IcSearch, IcChevDown } from './icons';
import { dateLabel, place, ROLE_LABEL, type Role } from '@/lib/model';
import Drawer from './Drawer';

const NAV: Record<Role, string[]> = {
  sales: ['discover', 'my', 'team'],
  events: ['approvals', 'discover', 'team', 'catalogue', 'insights', 'my'],
  management: ['insights', 'discover', 'team', 'my'],
  admin: ['approvals', 'discover', 'team', 'catalogue', 'insights', 'people', 'my'],
};
const LABEL: Record<string, string> = { discover: 'Discover', my: 'My events', approvals: 'Approvals', team: 'Team', catalogue: 'Catalogue', insights: 'Insights', people: 'People' };

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, data, palette, setPalette } = useApp();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const pending = data.requests.filter(r => r.status === 'requested').length + data.suggestions.filter(s => s.status === 'pending').length;
  const todo = data.requests.filter(r => r.personId === me.id && r.status === 'approved' && !r.rating).length;
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
                {LABEL[k]}{k === 'approvals' && pending > 0 && <span className="cnt">{pending}</span>}{k === 'my' && todo > 0 && <span className="cnt" title="Approved events with steps left">{todo}</span>}
              </Link>
            ))}
          </nav>
          <div className="top-r">
            <button className="kbtn" onClick={() => setPalette(true)} aria-label="Search events"><IcSearch /><span>Jump to an event</span><kbd>⌘K</kbd></button>
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
