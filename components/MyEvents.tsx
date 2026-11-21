'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import Link from 'next/link';
import { Tier, DateBlock, StatusPill, Confirm, Blank } from './ui';
import { IcCheck, IcPlus, IcCal } from './icons';
import { GS, MODES, TICKETS, chf, dateLabel, place, monthText, sugWhen, sugPlace, type Req } from '@/lib/model';

export default function MyEvents() {
  const { me, data, ev, open, act, busy, group, setGroup, people, today, seen, markSeen, isNew, hubspotAuto } = useApp();
  const mySugs = data.suggestions.filter(s => s.by === me.id).slice().reverse();
  // decisions since the last visit get a "New" tag for this visit; the badge in the top bar clears
  const [since, setSince] = useState<string | undefined>(undefined);
  useEffect(() => { if (seen !== undefined && since === undefined) { setSince(seen); markSeen(); } }, [seen, since, markSeen]);
  const mine = data.requests.filter(r => r.personId === me.id && r.status !== 'withdrawn');
  const byDate = (a: Req, b: Req) => (ev.get(a.eventId)?.sd?.getTime() ?? 9e15) - (ev.get(b.eventId)?.sd?.getTime() ?? 9e15);
  const started = (r: Req) => { const e = ev.get(r.eventId); return !!e && !!e.sd && e.mode !== 'tbd' && e.sd <= today; };
  const inHs = (r: Req) => r.hubspot || !!ev.get(r.eventId)?.hubspotId;
  const needs = (r: Req) => r.status === 'approved' && !r.rating && (!inHs(r) || started(r));
  const act1 = mine.filter(needs).sort(byDate);
  const wait = mine.filter(r => r.status === 'requested').sort(byDate);
  const upc = mine.filter(r => r.status === 'approved' && !r.rating && !needs(r)).sort(byDate);
  const closed = mine.filter(r => r.status === 'approved' && r.rating).sort(byDate).reverse();
  const dec = mine.filter(r => r.status === 'declined').sort(byDate);
  const leads = closed.reduce((a, r) => a + (r.leads || 0), 0);

  const card = (r: Req) => {
    const e = ev.get(r.eventId); if (!e) return null;
    const by = r.decidedBy ? people.get(r.decidedBy)?.name : null;
    return (
      <article key={r.id} className="mine">
        <DateBlock e={e} />
        <div style={{ minWidth: 0 }}>
          <button className="nm" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>{e.name}</button>{isNew(r, since) && <span className="tag red new">{r.status === 'approved' ? (r.createdBy !== me.id ? 'New: Roman added you' : e.past ? 'New: confirmed' : 'New: approved') : 'New: declined'}</span>}
          <div className="sub">{place(e)} · {dateLabel(e)} · {MODES[r.mode][0]}{r.ticket === 'paid' ? ` · ${chf(r.cost)}` : ` · ${r.ticket === 'have' ? 'own ticket' : 'free'}`}</div>
        </div>
        <div className="side"><Tier e={e} /><StatusPill r={r} past={started(r)} /></div>
        <div className="todo">
          {r.decisionNote && <div className="todo-i"><span className="dim">{r.status === 'declined' ? 'Declined' : 'Note'}{by ? ` by ${by}` : ''}: “{r.decisionNote}”</span></div>}
          {r.status === 'requested' && <div className="todo-i"><span className="dim">{e.past ? 'Visit logged. Roman confirms it, then you can debrief' : `Waiting for Roman · ${r.meetingsPlanned} meetings planned`} · {r.groups.map(g => GS[g]).join(', ')}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button className="btn sm line" onClick={() => open({ kind: 'event', id: e.id, view: 'edit-request', rid: r.id })}>Change</button>
              <Confirm label="Withdraw" sure="Yes, withdraw" disabled={busy} onYes={() => act('request_withdraw', { p_id: r.id }, 'Request withdrawn')} /></span></div>}
          {r.status === 'approved' && <>
            {e.hubspotId ? <div className="todo-i done"><span className="check on"><IcCheck s={12} /></span><span className="lbl">Event is in HubSpot</span><span className="dim small" style={{ marginLeft: 'auto' }}>added by Circuit</span></div>
            : <div className={`todo-i ${r.hubspot ? 'done' : ''}`}><span className={`check ${r.hubspot ? 'on' : ''}`}>{r.hubspot && <IcCheck s={12} />}</span><span className="lbl">Create the event in HubSpot</span>
              {!r.hubspot ? <button className="btn sm" disabled={busy} onClick={() => act('request_hubspot', { p_id: r.id, p_done: true }, 'HubSpot step done')}>Mark as done</button>
                : !r.rating && <button className="btn ghost sm" disabled={busy} onClick={() => act('request_hubspot', { p_id: r.id, p_done: false })}>Undo</button>}</div>}
            <div className={`todo-i ${r.rating ? 'done' : ''}`}><span className={`check ${r.rating ? 'on' : ''}`}>{r.rating ? <IcCheck s={12} /> : null}</span>
              <span className="lbl">{started(r) ? 'Assign leads in HubSpot and debrief' : 'After the event: assign leads and debrief'}</span>
              {r.rating ? <span className="dim small" style={{ marginLeft: 'auto' }}>{r.leads} leads · rated {r.rating}/5 · go again: {r.goAgain}</span>
                : started(r) && <button className="btn red sm" onClick={() => open({ kind: 'event', id: e.id, view: 'debrief', rid: r.id })}>Start 60-sec debrief</button>}</div>
            {!started(r) && <div className="todo-i"><Confirm label="I can’t go any more" sure="Yes, cancel my spot" disabled={busy} onYes={() => act('request_withdraw', { p_id: r.id }, 'Spot cancelled. Roman sees it.')} /></div>}
          </>}
        </div>
      </article>
    );
  };
  const sec = (t: string, lede: string, arr: Req[]) => arr.length > 0 && (
    <section className="sect"><h2 className="h2">{t} <span className="tag">{arr.length}</span></h2>{lede && <p className="lede">{lede}</p>}<div className="card">{arr.map(card)}</div></section>
  );
  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">My events</h1>
          <p className="lede">{hubspotAuto ? 'Your requests, Roman’s decisions and what’s left to do. Approved events go into HubSpot by themselves; after the event: assign your leads and a 60-second debrief.' : 'Your requests, Roman’s decisions and what’s left to do: log the event in HubSpot, and after the event a 60-second debrief.'}</p></div>
        <div className="stats">
          <div className="stat"><b className="num">{upc.length + act1.length}</b><span>approved</span></div>
          <div className="stat"><b className="num">{wait.length}</b><span>waiting</span></div>
          <div className="stat"><b className="num">{leads}</b><span>leads from your events</span></div>
        </div>
      </section>
      <div className="toolbar">
        <Link className="btn red" href="/discover">Find an event</Link>
        <button className="btn line" onClick={() => open({ kind: 'suggest' })}><IcPlus />Suggest an event</button>
        <span className="sp" />
        <label className="dim small" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>Your main target group
          <select className="select sm" style={{ width: 200 }} value={group} onChange={e => setGroup(Number(e.target.value))}>{GS.map((g, i) => <option key={g} value={i}>{g}</option>)}</select></label>
      </div>
      {!mine.length && <div className="card" style={{ marginTop: 10 }}><Blank icon={<IcCal s={22} />} title="No events yet" text="Find an event in the list, press “Request a spot”, and it shows up here with every next step." action={<Link className="btn red" href="/discover">Browse events</Link>} /></div>}
      {sec('To do', 'Steps left for events you were approved for.', act1)}
      {sec('Waiting for Roman', '', wait)}
      {sec('Coming up', '', upc)}
      {sec('Closed', 'Debrief done, leads logged.', closed)}
      {sec('Declined', '', dec)}
      {mySugs.length > 0 && (
        <section className="sect"><h2 className="h2">Your suggestions</h2><div className="card">{mySugs.map(s => {
          const fresh = s.status !== 'pending' && !!since && !!s.decidedAt && s.decidedAt > since && s.decidedBy !== me.id;
          return (
            <div key={s.id} className="mine" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div style={{ minWidth: 0 }}><b>{s.name}</b>{fresh && <span className="tag new">New</span>}
                <div className="sub">{[sugWhen(s), sugPlace(s)].filter(Boolean).join(' · ')}</div>
                {s.status === 'dismissed' && <p className="why" style={{ marginTop: 10, fontSize: 13.5 }}><b>{people.get(s.decidedBy || '')?.name?.split(' ')[0] || 'Roman'}:</b> {s.decisionNote || 'Not added for now.'}</p>}</div>
              <div className="side" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className={`pill ${s.status === 'added' ? 'ok' : s.status === 'pending' ? 'wait' : 'off'}`}>{s.status === 'added' ? 'In the calendar' : s.status === 'pending' ? 'Waiting for Roman' : 'Not added'}</span>
                {s.status === 'dismissed' && <button className="btn red sm" onClick={() => open({ kind: 'suggest', id: s.id })}>Improve and resend</button>}
                {s.status === 'pending' && s.source === 'app' && <button className="btn line sm" onClick={() => open({ kind: 'suggest', id: s.id })}>Change</button>}
                {s.status === 'added' && s.eventId && <button className="btn ghost sm" onClick={() => open({ kind: 'event', id: s.eventId!, view: 'detail' })}>Open</button>}
              </div>
            </div>
          );
        })}</div></section>
      )}
    </main>
  );
}
