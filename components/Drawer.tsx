'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Tier, Av } from './ui';
import { IcX, IcBack, IcCal, IcPin, IcExt, IcFlag, IcWarn, IcCheck, IcUsers, IcEdit } from './icons';
import { GROUPS, GS, MODES, TICKETS, POLICY, REGIONS, REGION_LABEL, SIZES, dateLabel, place, isStaff, chf, ymd, countryName, type Ev, type Mode, type Ticket, type Req } from '@/lib/model';

export default function Drawer() {
  const { drawer, close } = useApp();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.pal-wrap')) close(); };
    window.addEventListener('keydown', k);
    setTimeout(() => (ref.current?.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true }), 80);
    return () => window.removeEventListener('keydown', k);
  }, [drawer, close]);
  if (!drawer) return null;
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" ref={ref} aria-label="Details" role="dialog">
        {drawer.kind === 'event' && <EventPane key={drawer.id + drawer.view + (drawer.rid || '')} />}
        {drawer.kind === 'suggest' && <Suggest />}
        {drawer.kind === 'edit' && <Editor key={String(drawer.id)} id={drawer.id} />}
      </aside>
    </>
  );
}

function Head({ e, back }: { e: Ev; back?: () => void }) {
  const { close } = useApp();
  return (
    <header className="dr-h">
      <div className="dr-top">
        {back ? <button className="btn ghost sm" style={{ paddingLeft: 4 }} onClick={back}><IcBack />Back to event</button> : <span />}
        <button className="icon" onClick={close} aria-label="Close"><IcX /></button>
      </div>
      <h2 className="title">{e.name}</h2>
      <div className="dr-meta">
        <span><IcCal s={15} />{dateLabel(e)}</span>
        <span><IcPin s={15} />{place(e)}</span>
        {e.website && /^https?:\/\//.test(e.website) && <a href={e.website} target="_blank" rel="noopener noreferrer">Website <IcExt s={13} /></a>}
      </div>
      <div className="policy"><Tier e={e} full />{e.tk && e.tierPrev && e.tierPrev !== e.tk ? <span className="dim small">was Tier {e.tierPrev} last year</span> : null}{e.isNew && <span className="tag">New in the list</span>}</div>
    </header>
  );
}

function EventPane() {
  const { drawer, ev } = useApp();
  if (!drawer || drawer.kind !== 'event') return null;
  const e = ev.get(drawer.id);
  if (!e) return <div className="dr-b"><p className="empty">This event is not in the catalogue (any more).</p></div>;
  if (drawer.view === 'request' || drawer.view === 'edit-request') return <RequestForm e={e} rid={drawer.rid} />;
  if (drawer.view === 'sent') return <Sent e={e} />;
  if (drawer.view === 'debrief') return <Debrief e={e} rid={drawer.rid!} />;
  if (drawer.view === 'assign') return <Assign e={e} />;
  return <Detail e={e} />;
}

function Detail({ e }: { e: Ev }) {
  const { me, people, presence, group, open, act, busy, data, toast } = useApp();
  const p = presence(e.id);
  const all = [...p.approved, ...p.requested];
  const mine = all.find(r => r.personId === me.id);
  const staff = isStaff(me.role);
  const done = data.requests.filter(r => r.eventId === e.id && r.status === 'approved' && r.rating);
  const flag = data.flags.find(f => f.eventId === e.id);
  const fitted = !e.fit.every(x => x == null);
  return (
    <>
      <Head e={e} />
      <div className="dr-b">
        {flag && <div className="banner"><IcFlag /><span><b>Roman wants Bitcoin Suisse at this event.</b>{flag.note ? ` “${flag.note}”` : ''} Request it if it fits your clients.</span></div>}
        <section className="sec">
          <div className="lab"><span>Who from Bitcoin Suisse goes</span></div>
          {all.length ? <div className="people">{all.map(r => {
            const who = people.get(r.personId);
            return (
              <div className="person" key={r.id}>
                <Av p={who} req={r.status === 'requested'} size="lg" />
                <div><b>{who?.name || 'Former colleague'}{r.personId === me.id ? ' (you)' : ''}</b><small>{MODES[r.mode][0]}{who?.market ? ` · ${who.market}` : ''}</small></div>
                {r.status === 'approved' ? <span className="pill ok"><i />Going</span> : staff
                  ? <button className="btn ok sm" disabled={busy} onClick={async () => { const x = await act<number>('request_decide', { p_ids: [r.id], p_status: 'approved', p_note: '' }); if (x.ok) toast(Number(x.data) ? `Approved: ${who?.name}` : 'Nothing changed: it was withdrawn or decided in the meantime.', !Number(x.data)); }}><IcCheck s={12} />Approve</button>
                  : <span className="pill wait"><i />Waiting</span>}
              </div>
            );
          })}</div> : <div className="first"><IcUsers />{e.past ? 'Nobody from Bitcoin Suisse went.' : 'Nobody from Bitcoin Suisse yet. Be the first.'}</div>}
        </section>
        <section className="sec">
          <div className="lab"><span>What Tier {e.tk || '–'} means</span></div>
          <p className="note">{POLICY[e.tk][1]}</p>
        </section>
        {fitted && (
          <section className="sec">
            <div className="lab"><span>Who you meet there</span><span>fit 1–5 from the masterlist</span></div>
            <div className="fitrows">{GROUPS.map((n, i) => (
              <div key={n} className={`fitrow ${i === group ? 'me' : ''}`}><span>{n}</span><span className="track"><i style={{ width: `${(e.fit[i] || 0) * 20}%` }} /></span><b>{e.fit[i] ?? '–'}</b></div>
            ))}</div>
          </section>
        )}
        <section className="sec">
          <div className="lab"><span>Details</span></div>
          <div className="facts">
            <div className="fact"><span>Audience</span><b>{e.audience || 'n/a'}{e.size ? ` (${e.size})` : ''}</b></div>
            <div className="fact"><span>Ticket</span><b>{e.costTicket || 'n/a'}</b></div>
            <div className="fact"><span>Type</span><b>{e.kind || 'n/a'}</b></div>
            <div className="fact"><span>Team rating</span><b>{e.ratingN > 0 && e.ratingAvg != null ? `${Number(e.ratingAvg).toFixed(1)} / 5 from ${e.ratingN} colleagues` : 'not rated'}</b></div>
          </div>
        </section>
        {done.length > 0 && (
          <section className="sec">
            <div className="lab"><span>How it went</span><span>{done.length} debrief{done.length > 1 ? 's' : ''}</span></div>
            <div className="facts">
              <div className="fact"><span>Leads</span><b className="num" style={{ fontSize: 26 }}>{done.reduce((a, r) => a + (r.leads || 0), 0)}</b></div>
              <div className="fact"><span>Rating</span><b className="num" style={{ fontSize: 26 }}>{(done.reduce((a, r) => a + (r.rating || 0), 0) / done.length).toFixed(1)}</b></div>
            </div>
            {done.filter(r => r.debriefNote).map(r => <p key={r.id} className="note" style={{ marginTop: 10 }}><b>{people.get(r.personId)?.name} · go again: {r.goAgain}</b>{r.debriefNote}</p>)}
          </section>
        )}
        {(e.notes || e.history || e.comment || e.costSponsor || e.focus) && (
          <section className="sec">
            <details className="more"><summary>More from the masterlist</summary>
              {e.focus && <p className="note"><b>Focus</b>{e.focus}</p>}
              {e.costSponsor && <p className="note"><b>Sponsorship</b>{e.costSponsor}</p>}
              {e.notes && <p className="note"><b>Notes</b>{e.notes}</p>}
              {e.history && <p className="note"><b>Plan / activity so far</b>{e.history}</p>}
              {e.comment && <p className="note"><b>Comment (Uraitz)</b>{e.comment}</p>}
            </details>
          </section>
        )}
        {staff && (
          <section className="sec">
            <div className="lab"><span>For the events team</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn line sm" disabled={busy} onClick={() => act('flag_set', { p_event: e.id, p_on: !flag, p_note: '' }, flag ? 'Flag removed' : 'Flagged: sales see “Roman wants someone”')}><IcFlag s={14} />{flag ? 'Remove flag' : 'We need someone here'}</button>
              <button className="btn line sm" onClick={() => open({ kind: 'event', id: e.id, view: 'assign' })}><IcUsers s={14} />{e.past ? 'Log who was there' : 'Send someone'}</button>
              <button className="btn line sm" onClick={() => open({ kind: 'edit', id: e.id })}><IcEdit s={14} />Edit event</button>
            </div>
          </section>
        )}
      </div>
      <footer className="dr-f">
        {mine ? <>
          <span className="hint">{mine.status === 'approved' ? (e.past ? <><b>You were there.</b> Confirmed.</> : <><b>You’re going.</b> Approved.</>) : <><b>{e.past ? 'Logged.' : 'Requested.'}</b> Waiting for Roman.</>}</span>
          {mine.status === 'requested' && <button className="btn line" onClick={() => open({ kind: 'event', id: e.id, view: 'edit-request', rid: mine.id })}>Change</button>}
          <Link className="btn" href="/my">My events</Link>
        </> : e.past ? <>
          <span className="hint"><b>This event is over.</b> Were you there? Log it, Roman confirms, then you add your leads.</span>
          <button className="btn red" data-autofocus onClick={() => open({ kind: 'event', id: e.id, view: 'request' })}>I was there</button>
        </> : <button className="btn red lg" data-autofocus onClick={() => open({ kind: 'event', id: e.id, view: 'request' })}>Request a spot</button>}
      </footer>
    </>
  );
}

function RequestForm({ e, rid }: { e: Ev; rid?: string }) {
  const { me, people, presence, open, act, busy, data, events, flagged } = useApp();
  const existing = rid ? data.requests.find(r => r.id === rid) : undefined;
  const [mode, setMode] = useState<Mode>(existing?.mode || (e.tk && e.tk <= 2 ? 'speak' : 'attend'));
  const [ticket, setTicket] = useState<Ticket>(existing?.ticket || 'free');
  const [cost, setCost] = useState(existing?.cost ? String(existing.cost) : '');
  const [groups, setGroups] = useState<number[]>(existing?.groups || []);
  const past = e.past;
  const [meet, setMeet] = useState(existing?.meetingsPlanned ?? 4);
  const [why, setWhy] = useState(existing?.reason || '');
  const [err, setErr] = useState('');
  const strict = e.tk >= 4 && !e.past;
  const p = presence(e.id);
  const others = [...p.approved, ...p.requested].filter(r => r.personId !== me.id);
  const overlaps = useMemo(() => {
    if (!e.sd || e.mode !== 'exact') return [];
    return data.requests.filter(r => r.personId === me.id && (r.status === 'requested' || r.status === 'approved') && r.eventId !== e.id)
      .map(r => events.find(x => x.id === r.eventId)).filter((o): o is Ev => !!o && o.mode === 'exact' && !!o.sd && o.sd <= e.ed! && o.ed! >= e.sd!);
  }, [data.requests, events, e, me.id]);
  const hints: [string, string][] = [];
  if (past) hints.push(['', 'Roman confirms that you were there. Then it shows up in My events for the 60-second debrief with your leads.']);
  else if (strict) hints.push(['warn', `Tier ${e.tk}: the policy says don’t go. Add a reason so the events team can make an exception.`]);
  else if (e.tk) hints.push(['good', `Fits the policy for Tier ${e.tk}: ${POLICY[e.tk][0].toLowerCase()}.`]);
  const names = others.map(r => people.get(r.personId)?.name).filter(Boolean).join(', ');
  if (others.length) hints.push(['', past ? `Also there from Bitcoin Suisse: ${names}.` : `${others.length} colleague${others.length > 1 ? 's' : ''} already on it: ${names}. Agree who covers which clients.`]);
  if (!past) overlaps.forEach(o => hints.push(['warn', `Overlaps with ${o.name} (${dateLabel(o)}), which you also requested.`]));
  if (flagged.has(e.id)) hints.push(['good', 'The events team flagged this event. They want someone there.']);
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (strict && why.trim().length < 5) { setErr('Tier 4–5 events need a short reason.'); return; }
    if (!groups.length) { setErr('Pick at least one target group.'); return; }
    const args = { p_mode: mode, p_ticket: ticket, p_cost: ticket === 'paid' ? Math.max(0, Number(cost) || 0) : 0, p_groups: groups, p_meetings: past ? 0 : meet, p_reason: why.trim() };
    const r = existing ? await act('request_edit', { p_id: existing.id, ...args }, 'Request updated') : await act('request_create', { p_event: e.id, ...args });
    if (r.ok) open(existing ? { kind: 'event', id: e.id, view: 'detail' } : { kind: 'event', id: e.id, view: 'sent' }); else setErr(r.error || '');
  }
  return (
    <>
      <Head e={e} back={() => open({ kind: 'event', id: e.id, view: 'detail' })} />
      <form className="dr-b" id="reqForm" onSubmit={submit} noValidate>
        {past && <p className="note" style={{ paddingTop: 16 }}><b>Log your visit.</b> For events you went to without a request here. Takes 20 seconds.</p>}
        <div className="q"><span className="ql"><span className="no">1</span>{past ? 'How did you go?' : 'How do you go?'}</span>
          <div className="opts">{(Object.keys(MODES) as Mode[]).map(k => <button type="button" key={k} className="opt" aria-pressed={mode === k} onClick={() => setMode(k)}><b>{MODES[k][0]}</b><span>{MODES[k][1]}</span></button>)}</div></div>
        <div className="q"><span className="ql"><span className="no">2</span>Ticket</span>
          <div className="opts">{(Object.keys(TICKETS) as Ticket[]).map(k => <button type="button" key={k} className="opt" aria-pressed={ticket === k} onClick={() => setTicket(k)}><b>{TICKETS[k][0]}</b><span>{TICKETS[k][1]}</span></button>)}</div>
          {ticket === 'paid' && <div className="field" style={{ marginTop: 12 }}><label htmlFor="cost">Estimated cost (CHF)</label><input id="cost" className="input" type="number" min={0} step={50} inputMode="numeric" value={cost} onChange={x => setCost(x.target.value)} placeholder="e.g. 1500" /><span className="dim small">Masterlist: {e.costTicket || 'no price noted'}</span></div>}
        </div>
        <div className="q"><span className="ql"><span className="no">3</span>{past ? 'Who did you meet?' : 'Who do you want to meet?'}<span className="qh">pick one or more</span></span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{GROUPS.map((n, i) => <button type="button" key={n} className="chip" aria-pressed={groups.includes(i)} onClick={() => setGroups(g => g.includes(i) ? g.filter(x => x !== i) : [...g, i].sort())}>{n}<span className="n">{e.fit[i] ?? '–'}</span></button>)}</div></div>
        {!past && <div className="q"><span className="ql"><span className="no">4</span>Meetings you plan</span>
          <div className="stepper"><button type="button" onClick={() => setMeet(m => Math.max(0, m - 1))} aria-label="Fewer">−</button><output>{meet}</output><button type="button" onClick={() => setMeet(m => Math.min(500, m + 1))} aria-label="More">+</button></div></div>}
        <div className="q"><label className="ql" htmlFor="why"><span className="no">{past ? 4 : 5}</span>{past ? 'Anything Roman should know?' : 'Why this event?'}<span className="qh">{strict ? 'needed for Tier 4–5' : 'optional'}</span></label>
          <textarea id="why" className="area" value={why} onChange={x => setWhy(x.target.value)} placeholder="Pre-booked meetings, clients attending, a speaking slot…" maxLength={2000} />
          {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}</div>
        {hints.length > 0 && <div className="q"><span className="ql">Good to know</span><div className="hints">{hints.map((h, i) => <div key={i} className={`hint-i ${h[0]}`}>{h[0] === 'warn' ? <IcWarn /> : h[0] === 'good' ? <IcCheck /> : <IcUsers />}<span>{h[1]}</span></div>)}</div></div>}
      </form>
      <footer className="dr-f"><button type="submit" form="reqForm" className="btn red lg" disabled={busy} data-autofocus>{busy ? 'Sending…' : existing ? 'Save changes' : past ? 'Send to Roman to confirm' : 'Send request to Roman'}</button></footer>
    </>
  );
}

function Sent({ e }: { e: Ev }) {
  const { close } = useApp();
  if (e.past) return (
    <>
      <Head e={e} />
      <div className="dr-b">
        <div className="done-box">
          <div className="tick"><IcCheck s={28} /></div>
          <div><h3 className="h2">Visit logged</h3><p className="muted" style={{ marginTop: 6 }}>Roman confirms it. Then it shows up in My events: assign your leads in HubSpot and do the 60-second debrief.</p></div>
        </div>
      </div>
      <footer className="dr-f"><button className="btn" onClick={close}>Close</button><Link className="btn white lg" href="/my" onClick={close} data-autofocus>Go to My events</Link></footer>
    </>
  );
  return (
    <>
      <Head e={e} />
      <div className="dr-b">
        <div className="done-box">
          <div className="tick"><IcCheck s={28} /></div>
          <div><h3 className="h2">Request sent</h3><p className="muted" style={{ marginTop: 6 }}>Roman sees it in his inbox. Once he approves, it’s official: you go in the name of Bitcoin Suisse.</p></div>
          <div className="steps">
            <div className="stp done"><i><IcCheck s={13} /></i><div><b>Request</b><span>Sent just now</span></div></div>
            <div className="stp"><i>2</i><div><b>Approval</b><span>Policy, ticket and who else goes, in one view</span></div></div>
            <div className="stp"><i>3</i><div><b>Create the event in HubSpot</b><span>Reminder in My events</span></div></div>
            <div className="stp"><i>4</i><div><b>After the event</b><span>Assign leads in HubSpot and do the 60-second debrief</span></div></div>
          </div>
        </div>
      </div>
      <footer className="dr-f"><button className="btn" onClick={close}>Close</button><Link className="btn white lg" href="/my" onClick={close} data-autofocus>Go to My events</Link></footer>
    </>
  );
}

function Debrief({ e, rid }: { e: Ev; rid: string }) {
  const { data, act, busy, close, open } = useApp();
  const r = data.requests.find(x => x.id === rid);
  const [leads, setLeads] = useState(r?.leads != null ? String(r.leads) : '');
  const [held, setHeld] = useState(r?.meetingsHeld != null ? String(r.meetingsHeld) : '');
  const [rating, setRating] = useState(r?.rating || 0);
  const [again, setAgain] = useState<string>(r?.goAgain || '');
  const [note, setNote] = useState(r?.debriefNote || '');
  const [err, setErr] = useState('');
  if (!r) return null;
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (leads === '' || !rating || !again) { setErr('Fill in leads, rating and “go again”.'); return; }
    const res = await act('request_debrief', { p_id: rid, p_leads: Math.max(0, Math.round(Number(leads) || 0)), p_held: Math.max(0, Math.round(Number(held) || 0)), p_rating: rating, p_again: again, p_note: note.trim() }, 'Event closed. Thanks for the debrief.');
    if (res.ok) close(); else setErr(res.error || '');
  }
  return (
    <>
      <Head e={e} back={() => open({ kind: 'event', id: e.id, view: 'detail' })} />
      <form className="dr-b" id="debForm" onSubmit={submit} noValidate>
        <p className="note" style={{ paddingTop: 16 }}>60 seconds. This closes the event and feeds next year’s tiers, instead of a yearly rating round in Excel.</p>
        <div className="q"><div className="row2">
          <div className="field"><label htmlFor="leads">Leads assigned in HubSpot</label><input id="leads" className="input" type="number" min={0} inputMode="numeric" value={leads} onChange={x => setLeads(x.target.value)} data-autofocus /></div>
          <div className="field"><label htmlFor="held">Meetings held</label><input id="held" className="input" type="number" min={0} inputMode="numeric" value={held} onChange={x => setHeld(x.target.value)} /></div>
        </div></div>
        <div className="q"><span className="ql">How good was it for Bitcoin Suisse?</span>
          <div className="opts" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>{[1, 2, 3, 4, 5].map(i => <button type="button" key={i} className="opt" aria-pressed={rating === i} onClick={() => setRating(i)} style={{ alignItems: 'center' }}><b className="num" style={{ fontSize: 22 }}>{i}</b></button>)}</div></div>
        <div className="q"><span className="ql">Go again next year?</span>
          <div className="opts" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{[['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']].map(([k, l]) => <button type="button" key={k} className="opt" aria-pressed={again === k} onClick={() => setAgain(k)}><b>{l}</b></button>)}</div></div>
        <div className="q"><label className="ql" htmlFor="dnote">One line for the team</label><textarea id="dnote" className="area" value={note} onChange={x => setNote(x.target.value)} placeholder="Who was there, what worked, what to do differently" maxLength={2000} />{err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}</div>
      </form>
      <footer className="dr-f"><button type="submit" form="debForm" className="btn red lg" disabled={busy}>{busy ? 'Saving…' : 'Close the event'}</button></footer>
    </>
  );
}

function Assign({ e }: { e: Ev }) {
  const { data, act, busy, open, presence } = useApp();
  const taken = new Set([...presence(e.id).approved, ...presence(e.id).requested].map(r => r.personId));
  const choices = data.people.filter(p => p.active && !taken.has(p.id));
  const [who, setWho] = useState(choices[0]?.id || '');
  const [mode, setMode] = useState<Mode>('attend');
  const [note, setNote] = useState('');
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!who) return;
    const r = await act('request_assign', { p_event: e.id, p_person: who, p_mode: mode, p_note: note.trim() }, 'Done: approved and on their list');
    if (r.ok) open({ kind: 'event', id: e.id, view: 'detail' });
  }
  return (
    <>
      <Head e={e} back={() => open({ kind: 'event', id: e.id, view: 'detail' })} />
      <form className="dr-b" id="asgForm" onSubmit={submit}>
        <p className="note" style={{ paddingTop: 16 }}>{e.past ? 'Log who was there. It’s confirmed right away and shows up in their My events for the 60-second debrief.' : 'Send someone directly. It’s approved right away and shows up in their My events with the HubSpot steps.'}</p>
        <div className="q"><div className="field"><label htmlFor="who">Who</label>
          <select id="who" className="select" value={who} onChange={x => setWho(x.target.value)} data-autofocus>{choices.map(p => <option key={p.id} value={p.id}>{p.name}{p.market ? ` · ${p.market}` : ''}</option>)}</select></div></div>
        <div className="q"><span className="ql">How</span><div className="opts">{(Object.keys(MODES) as Mode[]).map(k => <button type="button" key={k} className="opt" aria-pressed={mode === k} onClick={() => setMode(k)}><b>{MODES[k][0]}</b></button>)}</div></div>
        <div className="q"><div className="field"><label htmlFor="anote">Note for them</label><input id="anote" className="input" value={note} onChange={x => setNote(x.target.value)} placeholder="e.g. panel slot confirmed, ticket via marketing" maxLength={1000} /></div></div>
      </form>
      <footer className="dr-f"><button type="submit" form="asgForm" className="btn red lg" disabled={busy || !who}>{e.past ? 'Log and confirm' : 'Send and approve'}</button></footer>
    </>
  );
}

function Suggest() {
  const { close, act, busy } = useApp();
  const [f, setF] = useState({ name: '', month: '', city: '', website: '', why: '' });
  const [err, setErr] = useState('');
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.name.trim()) { setErr('Add the event name.'); return; }
    const r = await act('suggestion_create', { p_name: f.name.trim(), p_month: f.month, p_city: f.city.trim(), p_website: f.website.trim(), p_reason: f.why.trim() }, 'Sent to the events team');
    if (r.ok) close(); else setErr(r.error || '');
  }
  const set = (k: keyof typeof f) => (x: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: x.target.value });
  return (
    <>
      <header className="dr-h"><div className="dr-top"><span /><button className="icon" onClick={close} aria-label="Close"><IcX /></button></div><h2 className="title">Suggest an <em style={{ fontStyle: 'normal', color: 'var(--red)' }}>event</em></h2><p className="muted">Missing something? The events team adds it to the calendar.</p></header>
      <form className="dr-b" id="sugForm" onSubmit={submit} noValidate>
        <div className="q"><div className="field"><label htmlFor="sname">Event name</label><input id="sname" className="input" value={f.name} onChange={set('name')} maxLength={200} data-autofocus /></div></div>
        <div className="q"><div className="row2"><div className="field"><label htmlFor="smonth">Month</label><input id="smonth" className="input" type="month" value={f.month} onChange={set('month')} /></div><div className="field"><label htmlFor="scity">City</label><input id="scity" className="input" value={f.city} onChange={set('city')} maxLength={120} /></div></div></div>
        <div className="q"><div className="field"><label htmlFor="sweb">Website</label><input id="sweb" className="input" type="url" value={f.website} onChange={set('website')} placeholder="https://" maxLength={500} /></div></div>
        <div className="q"><div className="field"><label htmlFor="swhy">Why should Bitcoin Suisse be there?</label><textarea id="swhy" className="area" value={f.why} onChange={set('why')} maxLength={2000} /></div>{err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}</div>
      </form>
      <footer className="dr-f"><button type="submit" form="sugForm" className="btn red lg" disabled={busy}>Send to the events team</button></footer>
    </>
  );
}

const EMPTY = { name: '', website: '', mode: 'exact', start: '', end: '', dateNote: '', region: 'EU', country: '', city: '', kind: '', focus: '', tier: '', audience: '', size: '', costTicket: '', costSponsor: '', notes: '', fit: ['', '', '', '', ''] };
function Editor({ id }: { id: number | null }) {
  const { ev, close, act, busy, open } = useApp();
  const e = id ? ev.get(id) : undefined;
  const [f, setF] = useState(() => e ? {
    name: e.name, website: e.website || '', mode: e.mode, start: e.sd ? ymd(e.sd) : '', end: e.ed ? ymd(e.ed) : '', dateNote: e.dateNote || '', region: e.region, country: e.country === 'TBA' ? '' : e.country,
    city: e.city || '', kind: e.kind || '', focus: e.focus || '', tier: e.tier ? String(e.tier) : '', audience: e.audience || '', size: e.size || '', costTicket: e.costTicket || '',
    costSponsor: e.costSponsor || '', notes: e.notes || '', fit: e.fit.map(x => x == null ? '' : String(x)),
  } : EMPTY);
  const [err, setErr] = useState('');
  const set = (k: string) => (x: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: x.target.value });
  async function submit(evt: React.FormEvent) {
    evt.preventDefault();
    if (!f.name.trim()) { setErr('Add a name.'); return; }
    if (f.mode !== 'tbd' && !f.start) { setErr('Add a start date (or choose “date TBD”).'); return; }
    if (f.mode === 'exact' && f.end && f.end < f.start) { setErr('The end is before the start.'); return; }
    const p_data = { ...f, start: f.mode === 'month' && f.start ? f.start.slice(0, 7) + '-01' : f.start, end: f.mode === 'exact' ? (f.end || f.start) : f.start, tier: f.tier ? Number(f.tier) : null, fit: f.fit.map(x => x ? Number(x) : null) };
    const r = await act<{ id: number }>('event_save', { p_id: id, p_data }, id ? 'Event saved' : 'Event added');
    if (r.ok && r.data) open({ kind: 'event', id: r.data.id, view: 'detail' }); else if (!r.ok) setErr(r.error || '');
  }
  return (
    <>
      <header className="dr-h"><div className="dr-top">{id ? <button className="icon" onClick={() => open({ kind: 'event', id, view: 'detail' })} aria-label="Back"><IcBack /></button> : <span />}<button className="icon" onClick={close} aria-label="Close"><IcX /></button></div>
        <h2 className="title">{id ? 'Edit event' : 'Add an event'}</h2></header>
      <form className="dr-b" id="edForm" onSubmit={submit} noValidate>
        <div className="q"><div className="field"><label htmlFor="en">Name</label><input id="en" className="input" value={f.name} onChange={set('name')} maxLength={200} data-autofocus /></div></div>
        <div className="q">
          <div className="field" style={{ marginBottom: 12 }}><span className="fl">Date</span><div className="seg">{[['exact', 'Exact dates'], ['month', 'Month only'], ['tbd', 'Date TBD']].map(([k, l]) => <button type="button" key={k} aria-pressed={f.mode === k} onClick={() => setF({ ...f, mode: k })}>{l}</button>)}</div></div>
          {f.mode === 'exact' && <div className="row2"><div className="field"><label htmlFor="es">Start</label><input id="es" className="input" type="date" value={f.start} onChange={set('start')} /></div><div className="field"><label htmlFor="ee">End</label><input id="ee" className="input" type="date" value={f.end} onChange={set('end')} /></div></div>}
          {f.mode === 'month' && <div className="row2"><div className="field"><label htmlFor="em">Month</label><input id="em" className="input" type="month" value={f.start.slice(0, 7)} onChange={x => setF({ ...f, start: x.target.value ? x.target.value + '-01' : '' })} /></div><div className="field"><label htmlFor="edn">Note</label><input id="edn" className="input" value={f.dateNote} onChange={set('dateNote')} placeholder="e.g. usually June" maxLength={80} /></div></div>}
        </div>
        <div className="q"><div className="row3">
          <div className="field"><label htmlFor="ec">City</label><input id="ec" className="input" value={f.city} onChange={set('city')} maxLength={120} /></div>
          <div className="field"><label htmlFor="eco">Country</label><input id="eco" className="input" value={f.country} onChange={set('country')} placeholder="CH, UK, AT…" maxLength={40} />{f.country.trim() && <span className="dim small">Shown as: {countryName(f.country) || '–'}</span>}</div>
          <div className="field"><label htmlFor="er">Region</label><select id="er" className="select" value={f.region} onChange={set('region')}>{[...REGIONS.filter(r => r !== 'Other'), 'BM', 'LATAM', 'AF', 'TBA'].map(r => <option key={r} value={r}>{REGION_LABEL[r] || r}</option>)}</select></div>
        </div></div>
        <div className="q"><div className="row3">
          <div className="field"><label htmlFor="et">Tier 2027</label><select id="et" className="select" value={f.tier} onChange={set('tier')}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>Tier {t} · {POLICY[t][0]}</option>)}</select></div>
          <div className="field"><label htmlFor="esz">Audience size</label><select id="esz" className="select" value={f.size} onChange={set('size')}><option value="">n/a</option>{SIZES.map(s => <option key={s}>{s}</option>)}{f.size && !SIZES.includes(f.size) && <option>{f.size}</option>}</select></div>
          <div className="field"><label htmlFor="ek">Type</label><input id="ek" className="input" value={f.kind} onChange={set('kind')} placeholder="Crypto, TradFi…" maxLength={120} /></div>
        </div></div>
        <div className="q"><span className="ql">Buy-side fit (1–5)</span><div className="row3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>{GS.map((g, i) => <div className="field" key={g}><label htmlFor={`ef${i}`}>{g}</label><select id={`ef${i}`} className="select sm" value={f.fit[i]} onChange={x => { const fit = [...f.fit]; fit[i] = x.target.value; setF({ ...f, fit }); }}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>)}</div></div>
        <div className="q"><div className="field"><label htmlFor="ew">Website</label><input id="ew" className="input" type="url" value={f.website} onChange={set('website')} placeholder="https://" maxLength={500} /></div></div>
        <div className="q"><div className="row2"><div className="field"><label htmlFor="ect">Ticket cost</label><input id="ect" className="input" value={f.costTicket} onChange={set('costTicket')} maxLength={300} /></div><div className="field"><label htmlFor="ecs">Sponsorship</label><input id="ecs" className="input" value={f.costSponsor} onChange={set('costSponsor')} maxLength={400} /></div></div></div>
        <div className="q"><div className="row2"><div className="field"><label htmlFor="ea">Audience</label><input id="ea" className="input" value={f.audience} onChange={set('audience')} maxLength={300} /></div><div className="field"><label htmlFor="efo">Focus</label><input id="efo" className="input" value={f.focus} onChange={set('focus')} maxLength={300} /></div></div></div>
        <div className="q"><div className="field"><label htmlFor="eno">Notes</label><textarea id="eno" className="area" value={f.notes} onChange={set('notes')} maxLength={4000} /></div>{err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}</div>
        {e && <div className="q"><button type="button" className="btn line" disabled={busy} onClick={async () => { const r = await act('event_archive', { p_id: e.id, p_archived: !e.archived }, e.archived ? 'Event back in the calendar' : 'Event archived: hidden for sales'); if (r.ok) close(); }}>{e.archived ? 'Restore to the calendar' : 'Archive event'}</button></div>}
      </form>
      <footer className="dr-f"><button type="submit" form="edForm" className="btn red lg" disabled={busy}>{id ? 'Save event' : 'Add event'}</button></footer>
    </>
  );
}

