'use client';
// The guided walkthrough: a few short steps per role, each pointing at the real screen.
// Started from the "Walkthrough" button in the top bar, the user menu, a first-visit offer or ?tour=1.
// It only shows and explains: the overlay blocks clicks, nothing is ever sent.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp, type DrawerState } from './AppProvider';
import { IcX } from './icons';
import type { Role } from '@/lib/model';

type App = ReturnType<typeof useApp>;
type Step = {
  path?: string;                        // the page the step lives on
  el?: string[];                        // what to point at: the first selector that is on screen; none = card in the middle
  click?: string;                       // e.g. switch to a tab first
  drawer?: (a: App) => DrawerState;     // a side panel to open for this step; other steps close it again
  title: string;
  text: string;
  /** the text when people sign in with Microsoft, if different */
  microsoft?: string;
  /** the text when approvals put events into HubSpot by themselves */
  hubspot?: string;
};

// a real upcoming key event to show the event page and the request form on (nothing gets sent)
const sample = (a: App, view: 'detail' | 'request'): DrawerState => {
  const e = a.events.find(x => !x.past && x.mode !== 'tbd' && (x.tk === 1 || x.tk === 2) && !a.presence(x.id).mine) || a.events.find(x => !x.past && !a.presence(x.id).mine);
  return e ? { kind: 'event', id: e.id, view } : null;
};
const TAB = (n: number) => `.tabs [role=tab]:nth-child(${n})`;
const VIEW = (n: number) => `.seg[aria-label="View"] button:nth-child(${n})`;   // 1 list, 2 calendar, 3 year
const SWITCH: Step = { path: '/discover', click: VIEW(1), el: ['.seg[aria-label="View"]'], title: 'List, calendar or year', text: 'Switch here between three views of the same events: the list, a month calendar and the whole year at a glance. Filters and search work in all three.' };
const CAL: Step = { path: '/discover', click: VIEW(2), el: ['.cal'], title: 'The calendar', text: 'Each bar is an event across its days, coloured by tier. Dots on a bar are colleagues: filled = approved, open = waiting. The legend on top explains every mark; events with only a month sit on the right.' };
const DONE: Step = { el: ['.tour-btn'], title: 'That’s it', text: 'You can start this walkthrough again anytime with this button. Everything else explains itself on the way.' };

const SALES: Step[] = [
  { title: 'Welcome to Circuit', text: 'All external events and conferences in one place. Find an event, ask for your spot, Roman approves it, and after the event you log your leads. One minute.' },
  { path: '/discover', el: ['.search'], title: 'Find an event', text: 'Type a name, a city, a country or an area like “Nordics” or “DACH”. Local names work too, for example “Wien”.' },
  { path: '/discover', el: ['.quick'], title: 'Quick filters', text: 'One click each: key events (Tier 1–2), events nobody from us covers yet, events in your country or area, and your own requests.' },
  SWITCH,
  CAL,
  { path: '/discover', click: VIEW(1), el: ['.erow:not(.past)'], title: 'One event per row', text: 'Date, place, tier and who from Bitcoin Suisse is already going. Tier 1–2 are the key events. Click a row to see everything about it.' },
  { path: '/discover', drawer: a => sample(a, 'detail'), el: ['.drawer'], title: 'The event page', text: 'Who goes, what the tier means, who you meet there and the details from the masterlist. The red button at the bottom asks for your spot.' },
  { path: '/discover', drawer: a => sample(a, 'request'), el: ['.drawer'], title: 'Ask for your spot', text: 'How you go, the ticket, who you want to meet and a short why. Takes 20 seconds, and Roman sees it right away. (Nothing is sent in this walkthrough.)' },
  { path: '/my', el: ['.head'], title: 'My events', text: 'Roman’s decisions land here, marked “New”. Once approved: create the event in HubSpot and tick it off. After the event: assign the leads in HubSpot and do the 60-second debrief. Went somewhere without asking first? Open the past event and press “I was there”.', hubspot: 'Roman’s decisions land here, marked “New”. Once approved, Circuit puts the event into HubSpot for you. After the event: assign the leads in HubSpot and do the 60-second debrief. Went somewhere without asking first? Open the past event and press “I was there”.' },
  { path: '/team', el: ['.matrix'], title: 'Who goes where', text: 'Everyone’s trips by month. Solid means approved, dashed means waiting for Roman. Check here so two people don’t cover the same clients.' },
  DONE,
];

const EVENTS: Step[] = [
  { title: 'Welcome to Circuit', text: 'Sales ask to go to external events, you decide, and you see what it brings: coverage, budget and leads. One minute.' },
  { path: '/approvals', el: ['.kpis'], title: 'Your numbers', text: 'Requests waiting for you, approved trips, the ticket budget, key events nobody covers yet and new event suggestions.' },
  { path: '/approvals', click: TAB(1), el: ['.tbl tbody tr.click', '.tabs ~ .card'], title: 'Review, then decide', text: 'Each row shows the event, the tier, who asks, how they go, the ticket and the policy check. “Review” opens everything sales entered (why, who they want to meet, cost) next to the event; approve or decline right there, with a note for sales if you like. Tick several rows to decide them at once. “Decided” lists everything you approved or declined.' },
  { path: '/approvals', click: TAB(3), el: ['.tabs ~ .card'], title: 'Flag the gaps', text: 'Tier 1–2 events where nobody from us goes yet. “Flag for sales” marks it “Flagged by Roman” for sales; “Send someone” books a person directly.' },
  { path: '/approvals', click: TAB(4), el: ['.tabs ~ .card'], title: 'Suggestions', text: 'Events sales missed in the list, with everything they knew. “Add to calendar” takes it all over and opens the editor for the tier. “Not now…” sends it back with a short reason; they can improve and resend it.' },
  { path: '/insights', el: ['.kpis'], title: 'Overview', text: 'Where Bitcoin Suisse shows up, what it costs and what comes back. Every number updates as sales request, you decide and people debrief.' },
  { path: '/insights', el: ['#by-team'], title: 'By team and person', text: 'Trips, open debriefs, leads, rating and budget for each sales team. Click a team to see its people, click a person to see their events.' },
  { path: '/insights', el: ['.report-dl'], title: 'Reports', text: 'A two-page PDF for a meeting, or all data as Excel to filter and sort.' },
  SWITCH,
  CAL,
  { path: '/discover', click: VIEW(1), drawer: a => sample(a, 'detail'), el: ['.drawer'], title: 'Your tools on every event', text: 'At the bottom of each event page: “We need someone here” flags it, “Send someone” books a person (after the event: log who was there), or edit the event.' },
  { path: '/catalogue', el: ['.tbl', '.head'], title: 'Catalogue', text: 'The masterlist as a table. Add, edit or archive events; tiers and fit live here.' },
  DONE,
];

const MANAGEMENT: Step[] = [
  { title: 'Welcome to Circuit', text: 'Where Bitcoin Suisse shows up at external events, what it costs and what comes back. Sales ask, Roman decides, you see everything. One minute.' },
  { path: '/insights', el: ['.kpis'], title: 'The headline numbers', text: 'Upcoming events, how many key events (Tier 1–2) we cover, approved trips, ticket budget and the leads from the debriefs.' },
  { path: '/insights', el: ['.season-wrap'], title: 'The season ahead', text: 'Every dot is an event. Rows are the tiers, left to right is time, bigger dots mean bigger audiences. A black ring means someone from Bitcoin Suisse is going. Hover a dot for details.' },
  { path: '/insights', el: ['#gaps'], title: 'The gaps', text: 'Key events where nobody from us goes yet. “Flagged” means Roman has asked sales to cover it.' },
  { path: '/insights', el: ['#by-team'], title: 'By team and person', text: 'Trips, open debriefs, leads, rating and budget for each sales team. Click a team to see its people, click a person to see their events. “By person” ranks everyone.' },
  { path: '/insights', el: ['#results'], title: 'Results per event', text: 'Leads, meetings, rating and “go again” from the 60-second debriefs after each event. This replaces the yearly rating round in Excel.' },
  { path: '/insights', el: ['.report-dl'], title: 'Take it with you', text: 'Download a two-page PDF report for a meeting, or everything as Excel to filter and sort yourself.' },
  { path: '/approvals', el: ['.tabs'], title: 'Requests', text: 'Every request and Roman’s decision, with his note. You see everything but don’t have to approve anything. The number on the tab shows what is waiting.' },
  { path: '/team', el: ['.matrix'], title: 'Who goes where', text: 'Everyone’s trips by month. Solid means approved, dashed means waiting.' },
  { path: '/discover', click: VIEW(1), el: ['.toolbar'], title: 'All events', text: 'The full list, exactly as sales see it: search by name, city, country or area, and filter by tier, region and more.' },
  SWITCH,
  CAL,
  DONE,
];

const ADMIN: Step[] = [
  ...EVENTS.slice(0, -1),
  { path: '/people', el: ['.head'], title: 'People', text: 'Create accounts and set role, market and team. New people get a one-time link to set their own password.', microsoft: 'Create accounts and set role, market and team. New people simply sign in with Microsoft.' },
  DONE,
];

export const STEPS: Record<Role, Step[]> = { sales: SALES, events: EVENTS, management: MANAGEMENT, admin: ADMIN };

type Box = { top: number; left: number; width: number; height: number };
const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
const pick = (sels?: string[]) => { for (const s of sels || []) { const el = [...document.querySelectorAll(s)].find(visible); if (el) return el as HTMLElement; } return null; };

export default function Tour({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { me } = app;
  const steps = STEPS[me.role];
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const opened = useRef(false);
  const path = usePathname();
  const router = useRouter();
  const step = steps[i];
  const appRef = useRef(app); appRef.current = app;

  // go to the step: page, side panel, tab, then find what to point at
  useEffect(() => {
    setReady(false);
    if (step.path && path !== step.path) { router.push(step.path); return; }
    const a = appRef.current;
    if (step.drawer) { const d = step.drawer(a); if (d) { a.open(d); opened.current = true; } }
    else if (a.drawer) a.close();
    if (step.click) (document.querySelector(step.click) as HTMLElement | null)?.click();
    let tries = 0, done = false;
    const find = () => {
      if (done) return;
      const el = pick(step.el);
      if (!el && step.el && tries++ < 40) { setTimeout(find, 80); return; }
      done = true;
      target.current = el;
      if (el && !el.closest('.drawer, .top')) {
        const top = document.querySelector('.top')?.getBoundingClientRect().bottom ?? 64;
        const r = el.getBoundingClientRect(), small = innerWidth < 640, room = innerHeight - top - (small ? 250 : 230);
        const sticky = el.closest('.mgroup') ? 44 : 0;   // the month header in the list sticks on top of rows
        const gap = (small || r.height > room ? 16 : Math.max(16, (room - r.height) / 2)) + sticky;
        window.scrollTo({ top: Math.max(0, scrollY + r.top - top - gap), behavior: 'smooth' });
      }
      setTimeout(() => { measure(); setReady(true); }, el ? 380 : 0);
    };
    setTimeout(find, step.drawer ? 260 : 60);
    return () => { done = true; };
  }, [i, path]); // eslint-disable-line react-hooks/exhaustive-deps

  function measure() {
    const el = target.current;
    if (!el || !el.isConnected) { setBox(null); return; }
    const r = el.getBoundingClientRect(), p = 6;
    const top = Math.max(r.top - p, 4), bottom = Math.min(r.bottom + p, innerHeight - 4);
    setBox({ top, left: Math.max(r.left - p, 4), width: Math.min(r.width + 2 * p, innerWidth - 8), height: Math.max(0, bottom - top) });
  }
  useEffect(() => {
    const f = () => measure();
    window.addEventListener('scroll', f, true); window.addEventListener('resize', f);
    return () => { window.removeEventListener('scroll', f, true); window.removeEventListener('resize', f); };
  }, []);

  // put the card next to the highlighted part (below, above, beside), on phones at the bottom
  useLayoutEffect(() => {
    const c = card.current; if (!c) return;
    const W = innerWidth, H = innerHeight, w = c.offsetWidth, h = c.offsetHeight, m = 12, g = 14;
    const top0 = (document.querySelector('.top')?.getBoundingClientRect().bottom ?? 64) + 8;
    const cl = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b));
    if (W < 640) { setPos(null); return; }
    if (!box) { setPos({ left: (W - w) / 2, top: (H - h) / 2 }); return; }
    const cx = cl(box.left + box.width / 2 - w / 2, m, W - w - m);
    if (box.top + box.height + g + h < H - m) setPos({ left: cx, top: box.top + box.height + g });
    else if (box.top - g - h > top0) setPos({ left: cx, top: box.top - g - h });
    else if (box.left + box.width + g + w < W - m) setPos({ left: box.left + box.width + g, top: cl(box.top, top0, H - h - m) });
    else if (box.left - g - w > m) setPos({ left: box.left - g - w, top: cl(box.top, top0, H - h - m) });
    else setPos({ left: cx, top: H - h - m });
  }, [box, ready, i]);

  // keyboard: → / Enter next, ← back, Esc closes. Captured first so nothing behind the overlay reacts.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!['ArrowRight', 'ArrowLeft', 'Enter', 'Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') finish(); else if (e.key === 'ArrowLeft') back(); else forward();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  useEffect(() => { if (ready) setTimeout(() => next.current?.focus({ preventScroll: true }), 120); }, [ready, i]);

  function finish() {
    if (opened.current && appRef.current.drawer) appRef.current.close();
    try { localStorage.setItem('circuit.tour.' + me.id, 'done'); } catch { /* storage off */ }
    onClose();
  }
  const forward = () => { if (i >= steps.length - 1) finish(); else setI(i + 1); };
  const back = () => { if (i > 0) setI(i - 1); };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Walkthrough">
      <div className="tour-block" />
      <div className={`tour-spot ${box ? '' : 'none'}`} style={box ? { top: box.top, left: box.left, width: box.width, height: box.height } : undefined} />
      <div ref={card} className={`tour-card ${ready ? '' : 'wait'}`} style={pos ? { top: pos.top, left: pos.left } : undefined} aria-live="polite">
        <button className="x" onClick={finish} aria-label="Close the walkthrough"><IcX s={15} /></button>
        <span className="k">Walkthrough · {i + 1} of {steps.length}</span>
        <h3>{step.title}</h3>
        <p>{app.microsoft && step.microsoft ? step.microsoft : app.hubspotAuto && step.hubspot ? step.hubspot : step.text}</p>
        <div className="row">
          <span className="tour-dots" aria-hidden="true">{steps.map((_, n) => <i key={n} className={n === i ? 'on' : n < i ? 'done' : ''} />)}</span>
          {i > 0 && <button className="btn sm line" onClick={back}>Back</button>}
          <button ref={next} className="btn sm red" onClick={forward}>{i === 0 ? 'Start' : i === steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

/** a small card on the first visit: offer the walkthrough once */
export function TourOffer({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const { microsoft } = useApp();
  return (
    <div className="tour-offer" role="dialog" aria-label="Walkthrough">
      <b>New here?</b>
      <p>A one-minute walkthrough shows you how Circuit works.</p>
      {!microsoft && <p className="tip">Tip: set your own password under your name (top right) → Change password.</p>}
      <div className="row"><button className="btn sm red" onClick={onStart}>Start the walkthrough</button><button className="btn sm ghost" onClick={onLater}>Not now</button></div>
    </div>
  );
}
