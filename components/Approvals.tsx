'use client';
// The events team's inbox: decide requests (one or many), see coverage gaps, add suggested events.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { Tier, DateBlock, Av, Confirm, Blank } from './ui';
import ReportMenu from './ReportMenu';
import { IcCheck, IcX, IcFlag, IcUsers, IcWarn, IcInfo, IcChevDown } from './icons';
import { GS, MODES, ML, POLICY, roleText, chf, dateLabel, place, bestFit, isStaff, monthText, sugWhen, sugPlace, type Ev, type Suggestion } from '@/lib/model';

type Tab = 'inbox' | 'decided' | 'coverage' | 'suggestions';

export default function Approvals() {
  const { me, data, ev, people, presence, act, busy, open, toast, hubspotAuto } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inbox');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [exp, setExp] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [who, setWho] = useState('');
  const [covTiers, setCovTiers] = useState<number[]>([1, 2]);
  // after adding a suggested event, open its editor so country, tier and fit get filled in
  const [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => { if (fresh && ev.has(fresh)) { open({ kind: 'edit', id: fresh }); setFresh(null); } }, [fresh, ev, open]);

  const pending = data.requests.filter(r => r.status === 'requested' && ev.has(r.eventId) && (!who || r.personId === who))
    .sort((a, b) => (ev.get(a.eventId)!.sd?.getTime() ?? 9e15) - (ev.get(b.eventId)!.sd?.getTime() ?? 9e15));
  const decided = data.requests.filter(r => (r.status === 'approved' || r.status === 'declined') && r.decidedAt).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!)).slice(0, 80);
  const showHs = hubspotAuto || decided.some(r => !!ev.get(r.eventId)?.hubspotId);
  const upcomingApproved = data.requests.filter(r => r.status === 'approved' && ev.get(r.eventId) && !ev.get(r.eventId)!.past);
  const spend = data.requests.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.cost || 0), 0);
  const gaps = useMemo(() => [...ev.values()].filter(e => !e.past && e.mode !== 'tbd' && covTiers.includes(e.tk) && !presence(e.id).approved.length && !presence(e.id).requested.length)
    .sort((a, b) => +a.sd! - +b.sd!), [ev, presence, covTiers]);
  const ro = me.role === 'management';
  if (!isStaff(me.role) && !ro) return <main className="page"><h1 className="title">Requests</h1><p className="muted" style={{ marginTop: 12 }}>Only Roman decides requests.</p></main>;
  const t12gaps = [...ev.values()].filter(e => !e.past && e.mode !== 'tbd' && (e.tk === 1 || e.tk === 2) && !presence(e.id).approved.length && !presence(e.id).requested.length).length;
  const sugs = data.suggestions.filter(s => s.status === 'pending');
  const requesters = [...new Set(data.requests.filter(r => r.status === 'requested').map(r => r.personId))].map(id => people.get(id)).filter(Boolean);

  async function decide(ids: string[], status: 'approved' | 'declined', n: string) {
    const r = await act<number>('request_decide', { p_ids: ids, p_status: status, p_note: n.trim() });
    if (!r.ok) return;
    const done = Number(r.data) || 0, verb = status === 'approved' ? 'Approved' : 'Declined';
    // someone may have withdrawn or decided in the meantime: the database only changes requests that are still waiting
    const toHs = status === 'approved' && hubspotAuto && done > 0;
    if (done === ids.length) toast(`${verb}: ${done} request${done > 1 ? 's' : ''}${toHs ? ' · goes to HubSpot automatically' : ''}`);
    else if (done === 0) toast('Nothing changed: it was withdrawn or decided in the meantime.', true);
    else toast(`${verb} ${done} of ${ids.length}. The others were changed in the meantime.`, true);
    setSel(new Set()); setNote(''); setExp(null);
    // HubSpot is filled in right after the answer; look again so "In HubSpot" shows up under Decided
    if (toHs) setTimeout(() => router.refresh(), 4000);
  }
  const policyChip = (e: Ev) => e.past ? <span className="pill off">Already happened</span> : e.tk >= 4 ? <span className="pill red"><IcWarn s={12} />Needs exception</span> : e.tk ? <span className="pill ok"><IcCheck s={11} />Fits the policy</span> : <span className="pill off">Not rated</span>;
  const allSel = pending.length > 0 && pending.every(r => sel.has(r.id));

  let lastMonth = '';
  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">Requests</h1><p className="lede">{ro ? 'Every request from sales to go to an external event, and what Roman decided.' : 'Every request from sales in one inbox. Open one with “Review” to see everything they entered, then approve or decline.'}</p></div>
        <div className="actions"><ReportMenu /></div>
      </section>
      <div className="kpis">
        <div className={`kpi ${pending.length ? 'red' : ''}`}><span>Waiting for a decision</span><b className="num">{data.requests.filter(r => r.status === 'requested').length}</b><small>requests</small></div>
        <div className="kpi"><span>Approved, coming up</span><b className="num">{upcomingApproved.length}</b><small>people at {new Set(upcomingApproved.map(r => r.eventId)).size} events</small></div>
        <div className="kpi"><span>Ticket spend approved</span><b className="num">{chf(spend)}</b><small>as entered by sales</small></div>
        <div className={`kpi ${t12gaps ? 'red' : ''}`}><span>Tier 1–2 without anyone</span><b className="num">{t12gaps}</b><small>upcoming events</small></div>
        <div className="kpi"><span>Suggested events</span><b className="num">{sugs.length}</b><small>to review</small></div>
      </div>
      {ro && <div className="ro"><IcInfo s={16} />You see everything here; Roman makes the decisions.</div>}
      <div className="tabs" role="tablist">
        {([['inbox', ro ? 'Waiting' : 'To decide', data.requests.filter(r => r.status === 'requested').length], ['decided', 'Decided', null], ['coverage', 'Coverage gaps', t12gaps], ['suggestions', 'Suggestions', sugs.length]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>
        ))}
      </div>

      {tab === 'inbox' && <>
        {requesters.length > 1 && <div className="toolbar"><select className="select sm" style={{ width: 240 }} value={who} onChange={e => setWho(e.target.value)} aria-label="Filter by person"><option value="">Everyone</option>{requesters.map(p => <option key={p!.id} value={p!.id}>{p!.name}</option>)}</select></div>}
        {!pending.length ? <div className="card"><Blank icon={<IcCheck s={22} />} title="Nothing waiting" text="When someone from sales requests an event, it lands here with the policy check, the cost and who else is going. Approving takes one click." /></div> : (
          <div className="card scroll-x">
            <table className="tbl inbox">
              <thead><tr>
                {!ro && <th style={{ width: 40 }}><button className={`check ${allSel ? 'on' : sel.size ? 'some' : ''}`} aria-label="Select all" onClick={() => setSel(allSel ? new Set() : new Set(pending.map(r => r.id)))}>{allSel && <IcCheck s={12} />}</button></th>}
                <th>Event</th><th>Tier</th><th>Who</th><th>How</th><th className="r">Ticket</th><th>Policy</th><th>Also going</th>{!ro && <th className="r">Decide</th>}
              </tr></thead>
              <tbody>
                {pending.map(r => {
                  const e = ev.get(r.eventId)!, p = people.get(r.personId), others = [...presence(e.id).approved, ...presence(e.id).requested].filter(x => x.id !== r.id);
                  const mk = e.mk; const head = mk !== lastMonth; lastMonth = mk;
                  return (
                    <Fragment key={r.id}>
                      {head && <tr className="grp"><td colSpan={9}>{mk === 'TBD' ? 'Date TBD' : `${ML[Number(mk.slice(5)) - 1]} ${mk.slice(0, 4)}`}</td></tr>}
                      <tr className={`click ${sel.has(r.id) || exp === r.id ? 'sel' : ''}`} onClick={() => setExp(x => x === r.id ? null : r.id)}>
                        {!ro && <td className="c-chk" onClick={x => x.stopPropagation()}><button className={`check ${sel.has(r.id) ? 'on' : ''}`} aria-label="Select" onClick={() => setSel(s => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>{sel.has(r.id) && <IcCheck s={12} />}</button></td>}
                        <td className="c-ev"><div className="ev"><DateBlock e={e} /><div style={{ minWidth: 0 }}><b>{e.name}</b><span>{place(e)}</span>{e.past && <span className="tag" style={{ marginTop: 4 }}>Logged after the event</span>}</div></div></td>
                        <td className="c-tier"><Tier e={e} /></td>
                        <td className="c-who"><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Av p={p} /><div><b style={{ fontWeight: 560 }}>{p?.name}</b><div className="dim small">{p?.market || p?.team}</div></div></div></td>
                        <td className="nowrap c-how">{MODES[r.mode][0].split(' & ')[0]}<div className="dim small">{e.past ? 'was there' : `${r.meetingsPlanned} meetings`}</div></td>
                        <td className="r nowrap c-tk">{r.ticket === 'paid' ? chf(r.cost) : <span className="dim">{r.ticket === 'free' ? 'free' : 'covered'}</span>}</td>
                        <td className="c-pol">{policyChip(e)}</td>
                        <td className="c-also">{others.length ? <span className="avs"><span className="m-only dim small" style={{ marginRight: 6 }}>Also going</span>{others.slice(0, 4).map(o => <Av key={o.id} p={people.get(o.personId)} req={o.status === 'requested'} size="sm" />)}</span> : <span className="dim small">no one<span className="m-only"> else going</span></span>}</td>
                        {!ro && <td className="r nowrap c-dec" onClick={x => x.stopPropagation()}>
                          <button className={`btn sm ${exp === r.id ? 'line' : 'dark'}`} onClick={() => { setExp(x => x === r.id ? null : r.id); setNote(''); }} aria-expanded={exp === r.id} aria-label={`Review ${p?.name}`}>
                            {exp === r.id ? 'Close' : <>Review<IcChevDown s={13} /></>}
                          </button>
                        </td>}
                      </tr>
                      {exp === r.id && (
                        <tr className="detail"><td colSpan={9}>
                          <div className="rv">
                            <section>
                              <p className="lab">The request</p>
                              <div className="rv-who"><Av p={p} /><div><b>{p?.name}</b><span className="dim small">{[p?.title, p?.market || p?.team].filter(Boolean).join(' · ') || (p ? roleText(p) : '')}</span></div>
                                <span className="dim small" style={{ marginLeft: 'auto' }}>sent {new Date(r.createdAt).toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' })}</span></div>
                              <dl className="rv-facts">
                                <div><dt>How</dt><dd>{MODES[r.mode][0]}<small>{MODES[r.mode][1]}</small></dd></div>
                                <div><dt>Ticket</dt><dd>{r.ticket === 'paid' ? <>{chf(r.cost)}<small>paid, needs budget</small></> : r.ticket === 'free' ? <>Free<small>guest, speaker or partner pass</small></> : <>Has one<small>ticket or invite already there</small></>}</dd></div>
                                <div><dt>{e.past ? 'Meetings' : 'Meetings planned'}</dt><dd>{e.past ? 'was there' : r.meetingsPlanned || '–'}</dd></div>
                              </dl>
                              <p className="lab" style={{ margin: '14px 0 8px' }}>Wants to meet</p>
                              <div className="ctx">{r.groups.length ? r.groups.map(g => <span key={g} className="tag">{GS[g]} · fit {e.fit[g] ?? '–'}/5</span>) : <span className="dim small">not given</span>}</div>
                              <p className="lab" style={{ margin: '14px 0 8px' }}>Why</p>
                              {r.reason ? <p className="why">{r.reason}</p> : <p className="dim small">No reason given.</p>}
                            </section>
                            <section>
                              <p className="lab">The event</p>
                              <p className="rv-ev"><b>{e.name}</b><span className="dim small">{dateLabel(e)} · {place(e)}</span></p>
                              <dl className="rv-facts">
                                <div><dt>Tier</dt><dd><Tier e={e} /><small>{POLICY[e.tk][1]}</small></dd></div>
                                <div><dt>Policy</dt><dd>{policyChip(e)}</dd></div>
                                <div><dt>Also going</dt><dd>{others.length ? others.map(o => <span key={o.id} className="rv-o">{people.get(o.personId)?.name}<small>{o.status === 'requested' ? ' (asked)' : ''}</small></span>) : <span className="dim">no one else</span>}</dd></div>
                                <div><dt>Audience</dt><dd>{e.audience || <span className="dim">n/a</span>}</dd></div>
                                <div><dt>Ticket price</dt><dd>{e.costTicket || <span className="dim">n/a</span>}</dd></div>
                              </dl>
                              <button className="btn ghost sm" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>Everything about the event →</button>
                            </section>
                          </div>
                          {!ro && <div className="rv-decide">
                            <input className="input" placeholder={`Note for ${p?.name?.split(' ')[0] || 'sales'} (optional)`} value={note} onChange={x => setNote(x.target.value)} maxLength={1000} aria-label="Note for sales" />
                            <button className="btn ok" disabled={busy} onClick={() => decide([r.id], 'approved', note)} aria-label={`Approve ${p?.name}`}><IcCheck s={14} />Approve</button>
                            <button className="btn line" disabled={busy} onClick={() => decide([r.id], 'declined', note)} aria-label={`Decline ${p?.name}`}><IcX s={13} />Decline</button>
                          </div>}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!ro && sel.size > 0 && (
          <div className="bulk">
            <b>{sel.size} selected</b>
            <input className="input" placeholder="Note for sales (optional)" value={note} onChange={x => setNote(x.target.value)} maxLength={1000} />
            <button className="btn red" disabled={busy} onClick={() => decide([...sel], 'approved', note)}>Approve {sel.size}</button>
            <button className="btn line" disabled={busy} onClick={() => decide([...sel], 'declined', note)}>Decline {sel.size}</button>
            <button className="btn line" onClick={() => setSel(new Set())}>Cancel</button>
          </div>
        )}
      </>}

      {tab === 'decided' && (!decided.length ? <div className="card"><Blank title="No decisions yet" text="Approved and declined requests show up here, with who decided and when." /></div> : (
        <div className="card scroll-x"><table className="tbl">
          <thead><tr><th>Event</th><th>Who</th><th>Decision</th><th>By</th><th>When</th><th>Note</th>{showHs && <th>HubSpot</th>}<th /></tr></thead>
          <tbody>{decided.map(r => {
            const e = ev.get(r.eventId); if (!e) return null;
            return (
              <tr key={r.id}>
                <td><button className="ev" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}><DateBlock e={e} /><div><b>{e.name}</b><span>{place(e)}</span></div></button></td>
                <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Av p={people.get(r.personId)} size="sm" />{people.get(r.personId)?.name}</div></td>
                <td><span className={`pill ${r.status === 'approved' ? 'ok' : 'off'}`}>{r.status === 'approved' ? 'Approved' : 'Declined'}</span></td>
                <td className="nowrap">{people.get(r.decidedBy || '')?.name || '–'}</td>
                <td className="nowrap dim">{new Date(r.decidedAt!).toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' })}</td>
                <td className="dim" style={{ maxWidth: 280 }}>{r.decisionNote || '–'}</td>
                {showHs && <td className="nowrap">{r.status !== 'approved' ? null : e.hubspotId ? <span className="pill ok"><IcCheck s={11} />In HubSpot</span>
                  : !ro ? <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>Add to HubSpot →</button> : <span className="dim">–</span>}</td>}
                <td className="r">{!ro && !r.rating && <Confirm label="Reopen" sure="Back to inbox" disabled={busy} onYes={() => act('request_reopen', { p_id: r.id }, 'Back in the inbox')} />}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ))}

      {tab === 'coverage' && <>
        <div className="toolbar"><span className="dim small">Upcoming events where no one from Bitcoin Suisse has asked to go.</span><span style={{ flex: 1 }} />
          {[1, 2, 3].map(t => <button key={t} className="chip" aria-pressed={covTiers.includes(t)} onClick={() => setCovTiers(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t])}><i className="sw" style={{ background: `var(--t${t})` }} />Tier {t}</button>)}</div>
        {!gaps.length ? <div className="card"><Blank icon={<IcCheck s={22} />} title="All covered" text="Every upcoming event in these tiers has someone from Bitcoin Suisse." /></div> : (
          <div className="card scroll-x"><table className="tbl">
            <thead><tr><th>Event</th><th>Tier</th><th>Best fit</th><th>Size</th>{!ro && <th className="r">Action</th>}</tr></thead>
            <tbody>{gaps.map(e => {
              const fl = data.flags.some(f => f.eventId === e.id);
              return (
                <tr key={e.id}>
                  <td><button className="ev" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}><DateBlock e={e} /><div><b>{e.name}</b><span>{place(e)} · {dateLabel(e)}</span></div></button></td>
                  <td><Tier e={e} /></td>
                  <td className="dim">{bestFit(e)}</td>
                  <td className="dim">{e.size || '–'}</td>
                  {!ro && <td className="r nowrap"><span style={{ display: 'inline-flex', gap: 6 }}>
                    <button className={`btn sm ${fl ? '' : 'line'}`} disabled={busy} onClick={() => act('flag_set', { p_event: e.id, p_on: !fl, p_note: '' }, fl ? 'Flag removed' : 'Flagged for sales')}><IcFlag s={13} />{fl ? 'Flagged' : 'Flag for sales'}</button>
                    <button className="btn line sm" onClick={() => open({ kind: 'event', id: e.id, view: 'assign' })}><IcUsers s={13} />Send someone</button>
                  </span></td>}
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </>}

      {tab === 'suggestions' && (!sugs.length ? <div className="card"><Blank title="No suggestions" text="When someone misses an event in the list, they suggest it and it shows up here to add." /></div> : (
        <div className="card">{sugs.map(s => <SuggestionCard key={s.id} s={s} ro={ro} onAdded={setFresh} />)}</div>
      ))}
    </main>
  );
}

// quick reasons Roman can send back with one click (then edit the text if he likes)
const REASONS = ['Too vague: please add exact dates, city and website.', 'Already in the calendar.', 'Not a fit for Bitcoin Suisse right now.'];

function SuggestionCard({ s, ro, onAdded }: { s: Suggestion; ro: boolean; onAdded: (id: number) => void }) {
  const { people, act, busy } = useApp();
  const [no, setNo] = useState(false);
  const [note, setNote] = useState('');
  const d = s.details || {}, who = people.get(s.by || '')?.name || 'a colleague', first = who.split(' ')[0];
  const resent = !!s.decisionNote && !!s.decidedAt && !!s.updatedAt && s.updatedAt > s.decidedAt;
  const facts = [['Type', d.kind], ['Audience size', d.size], ['Ticket', d.costTicket], ['Sponsoring', d.costSponsor], ['Who goes', d.audience]].filter(([, v]) => v) as [string, string][];
  const where = sugPlace(s);
  async function add() {
    const r = await act<{ eventId: number }>('suggestion_decide', { p_id: s.id, p_add: true }, 'Added. Check it and set the tier.');
    if (r.ok && r.data?.eventId) onAdded(r.data.eventId);
  }
  async function decline() {
    const r = await act('suggestion_decide', { p_id: s.id, p_add: false, p_note: note.trim() }, `Sent back to ${first}`);
    if (r.ok) setNo(false);
  }
  return (
    <div className="mine sug" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 15 }}>{s.name}</b>
        <div className="sub">{[sugWhen(s), where || 'No place yet'].join(' · ')} · {s.source === 'masterlist' ? 'comment in the masterlist' : `from ${who}`}</div>
        {resent && <p className="dim small" style={{ marginTop: 8 }}>You sent it back (“{s.decisionNote}”). {first} updated it.</p>}
        {facts.length > 0 && <dl className="sug-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        {s.reason && <p className="why" style={{ marginTop: 10, fontSize: 13.5 }}>{s.reason}</p>}
        {d.notes && <p className="note small" style={{ marginTop: 8 }}>{d.notes}</p>}
        {s.website && (/^https?:\/\//i.test(s.website) ? <a className="dim small" href={s.website} target="_blank" rel="noopener noreferrer">{s.website}</a> : <span className="dim small">{s.website}</span>)}
        {no && <div className="sug-no">
          <p className="lab">Why not? {first} sees this</p>
          <div className="chips">{REASONS.map(r => <button type="button" key={r} className="chip" aria-pressed={note === r} onClick={() => setNote(r)}>{r.split(':')[0].replace(/\.$/, '')}</button>)}</div>
          <textarea className="area" value={note} onChange={x => setNote(x.target.value)} maxLength={1000} placeholder={`A short note to ${first} (optional)`} aria-label={`Note to ${first}`} />
          <div style={{ display: 'flex', gap: 8 }}><button className="btn red sm" disabled={busy} onClick={decline}>Send back to {first}</button><button className="btn ghost sm" onClick={() => { setNo(false); setNote(''); }}>Cancel</button></div>
        </div>}
      </div>
      {!ro && !no && <div className="side" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <button className="btn ok sm" disabled={busy} onClick={add}>Add to calendar</button>
        <button className="btn line sm" disabled={busy} onClick={() => setNo(true)}>Not now…</button>
      </div>}
    </div>
  );
}
