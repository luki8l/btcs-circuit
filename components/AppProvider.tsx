'use client';
// Everything the pages share: the data from the server (refreshed after every change), who is signed in,
// the event drawer, toasts, tooltips and the command palette.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pd, prep, type Data, type Ev, type Person, type Req, type PresenceInfo } from '@/lib/model';

export type DrawerState =
  | { kind: 'event'; id: number; view: 'detail' | 'request' | 'edit-request' | 'sent' | 'debrief' | 'assign'; rid?: string }
  | { kind: 'suggest'; id?: string }
  | { kind: 'edit'; id: number | null }
  | null;

type Ctx = {
  data: Data; me: Data['me']; today: Date; events: Ev[]; ev: Map<number, Ev>; people: Map<string, Person>;
  active: Map<number, Req[]>; flagged: Set<number>; presence: (id: number) => PresenceInfo;
  group: number; setGroup: (g: number) => void;
  drawer: DrawerState; open: (d: DrawerState) => void; close: () => void;
  toast: (m: string, bad?: boolean) => void;
  act: <T = unknown>(fn: string, args: Record<string, unknown>, ok?: string) => Promise<{ ok: boolean; data?: T; error?: string }>;
  busy: boolean; palette: boolean; setPalette: (b: boolean) => void;
  /** when this person last opened My events (undefined until read in the browser) */
  seen: string | undefined; markSeen: () => void;
  /** a decision on my request that I have not seen yet */
  isNew: (r: Req, since?: string) => boolean;
};
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('no app context'); return c; };

export default function AppProvider({ data, children }: { data: Data; children: React.ReactNode }) {
  const router = useRouter();
  const today = useMemo(() => pd(data.today), [data.today]);
  const events = useMemo(() => data.events.map(e => prep(e, today)), [data.events, today]);
  const ev = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const people = useMemo(() => new Map(data.people.map(p => [p.id, p])), [data.people]);
  const active = useMemo(() => {
    const m = new Map<number, Req[]>();
    for (const r of data.requests) if (r.status === 'requested' || r.status === 'approved') { const a = m.get(r.eventId) || []; a.push(r); m.set(r.eventId, a); }
    return m;
  }, [data.requests]);
  const flagged = useMemo(() => new Set(data.flags.map(f => f.eventId)), [data.flags]);
  const presence = useCallback((id: number): PresenceInfo => {
    const rs = active.get(id) || [];
    return { approved: rs.filter(r => r.status === 'approved'), requested: rs.filter(r => r.status === 'requested'), flagged: flagged.has(id), mine: rs.some(r => r.personId === data.me.id) };
  }, [active, flagged, data.me.id]);

  const [group, setGroupS] = useState(2);
  useEffect(() => { try { const g = Number(localStorage.getItem('circuit.group')); if (g >= 0 && g <= 4 && localStorage.getItem('circuit.group') !== null) setGroupS(g); } catch { /* storage off */ } }, []);
  const setGroup = (g: number) => { setGroupS(g); try { localStorage.setItem('circuit.group', String(g)); } catch { /* storage off */ } };

  const seenKey = 'circuit.seen.' + data.me.id;
  const [seen, setSeen] = useState<string | undefined>(undefined);
  useEffect(() => { try { setSeen(localStorage.getItem(seenKey) || '1970-01-01'); } catch { /* storage off: nothing is "new" */ } }, [seenKey]);
  const markSeen = useCallback(() => { const n = new Date().toISOString(); try { localStorage.setItem(seenKey, n); setSeen(n); } catch { /* storage off */ } }, [seenKey]);
  const isNew = useCallback((r: Req, since = seen) => !!since && r.personId === data.me.id && !!r.decidedAt && r.decidedAt > since && r.decidedBy !== data.me.id
    && (r.status === 'approved' || r.status === 'declined'), [seen, data.me.id]);

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const open = useCallback((d: DrawerState) => {
    setDrawer(d);
    try { const u = new URL(location.href); if (d && d.kind === 'event') u.searchParams.set('e', String(d.id)); else u.searchParams.delete('e'); history.replaceState(history.state, '', u); } catch { /* ignore */ }
  }, []);
  const close = useCallback(() => open(null), [open]);
  useEffect(() => { try { const id = Number(new URL(location.href).searchParams.get('e')); if (id && ev.has(id)) setDrawer({ kind: 'event', id, view: 'detail' }); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [toasts, setToasts] = useState<{ id: number; m: string; bad?: boolean } | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string, bad?: boolean) => {
    setToasts({ id: Date.now(), m, bad });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToasts(null), bad ? 5200 : 2800);
  }, []);

  const [busy, setBusy] = useState(false);
  const last = useRef(Date.now());   // last time the data came from the server
  const act = useCallback(async <T,>(fn: string, args: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn, args }) });
      if (res.status === 401) { location.assign('/login'); return { ok: false, error: 'signed out' }; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast(j.error || 'That did not work.', true); return { ok: false, error: j.error as string }; }
      if (okMsg) toast(okMsg);
      last.current = Date.now();
      router.refresh();
      return { ok: true, data: j.data as T };
    } catch {
      toast('No connection. Try again.', true);
      return { ok: false, error: 'network' };
    } finally { setBusy(false); }
  }, [router, toast]);

  // keep the data fresh without a reload: Roman's inbox, decisions, colleagues' requests
  useEffect(() => {
    const fresh = () => { if (document.visibilityState === 'visible' && Date.now() - last.current > 20000 && navigator.onLine) { last.current = Date.now(); router.refresh(); } };
    const t = setInterval(fresh, 120000);
    document.addEventListener('visibilitychange', fresh); window.addEventListener('focus', fresh);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', fresh); window.removeEventListener('focus', fresh); };
  }, [router]);

  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); }
      else if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement as HTMLElement)?.tagName || '')) { e.preventDefault(); setPalette(true); }
      else if (e.key === 'Escape') { setPalette(false); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // one tooltip for every element with data-tip (simple HTML from our own data, escaped where built)
  useEffect(() => {
    const tip = document.getElementById('tip'); if (!tip) return;
    const over = (e: MouseEvent) => { const t = (e.target as Element)?.closest?.('[data-tip]') as HTMLElement | null; if (!t) { tip.classList.remove('on'); return; } tip.innerHTML = t.dataset.tip || ''; tip.classList.add('on'); };
    const move = (e: MouseEvent) => { if (!tip.classList.contains('on')) return; const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 16; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 12; tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
    const hide = () => tip.classList.remove('on');
    document.addEventListener('mouseover', over); document.addEventListener('mousemove', move); document.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('mousemove', move); document.removeEventListener('scroll', hide, true); };
  }, []);

  const value: Ctx = { data, me: data.me, today, events, ev, people, active, flagged, presence, group, setGroup, drawer, open, close, toast, act, busy, palette, setPalette, seen, markSeen, isNew };
  return (
    <C.Provider value={value}>
      {children}
      <div id="tip" role="tooltip" />
      {toasts && <div key={toasts.id} className={`toast ${toasts.bad ? 'bad' : ''}`} role="status">{toasts.m}</div>}
    </C.Provider>
  );
}

/** escape text for data-tip HTML */
export const h = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
