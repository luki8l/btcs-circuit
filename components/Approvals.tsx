'use client';
// The events team's inbox: decide requests (one or many), see coverage gaps, add suggested events.
import { Fragment, useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Tier, DateBlock, Av, Confirm, Blank } from './ui';
import { IcCheck, IcX, IcFlag, IcUsers, IcWarn, IcInfo } from './icons';
import { GS, MODES, ML, POLICY, chf, dateLabel, place, bestFit, isStaff, type Ev } from '@/lib/model';

type Tab = 'inbox' | 'decided' | 'coverage' | 'suggestions';

export default function Approvals() {
  const { me, data, ev, people, presence, act, busy, open } = useApp();
  const [tab, setTab] = useState<Tab>('inbox');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [exp, setExp] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [covTiers, setCovTiers] = useState<number[]>([1, 2]);

  const pending = data.requests.filter(r => r.status === 'requested' && ev.has(r.eventId) && (!who || r.personId === who))
    .sort((a, b) => (ev.get(a.eventId)!.sd?.getTime() ?? 9e15) - (ev.get(b.eventId)!.sd?.getTime() ?? 9e15));
  const decided = data.requests.filter(r => (r.status === 'approved' || r.status === 'declined') && r.decidedAt).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!)).slice(0, 80);
  const upcomingApproved = data.requests.filter(r => r.status === 'approved' && ev.get(r.eventId) && !ev.get(r.eventId)!.past);
  const spend = data.requests.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.cost || 0), 0);
  const gaps = useMemo(() => [...ev.values()].filter(e => !e.past && e.mode !== 'tbd' && covTiers.includes(e.tk) && !presence(e.id).approved.length && !presence(e.id).requested.length)
    .sort((a, b) => +a.sd! - +b.sd!), [ev, presence, covTiers]);
  const ro = me.role === 'management';
  if (!isStaff(me.role) && !ro) return <main className="page"><h1 className="title">Requests</h1><p className="muted" style={{ marginTop: 12 }}>Only the events team decides requests.</p></main>;
  const t12gaps = [...ev.values()].filter(e => !e.past && e.mode !== 'tbd' && (e.tk === 1 || e.tk === 2) && !presence(e.id).approved.length && !presence(e.id).requested.length).length;
  const sugs = data.suggestions.filter(s => s.status === 'pending');
  const requesters = [...new Set(data.requests.filter(r => r.status === 'requested').map(r => r.personId))].map(id => people.get(id)).filter(Boolean);

  async function decide(ids: string[], status: 'approved' | 'declined', n: string) {
    const r = await act<number>('request_decide', { p_ids: ids, p_status: status, p_note: n.trim() }, `${status === 'approved' ? 'Approved' : 'Declined'}: ${ids.length} request${ids.length > 1 ? 's' : ''}`);
    if (r.ok) { setSel(new Set()); setNote(''); setDeclining(null); setExp(null); }
  }
  const policyChip = (e: Ev) => e.tk >= 4 ? <span className="pill red"><IcWarn s={12} />Needs exception</span> : e.tk ? <span className="pill ok"><IcCheck s={11} />Fits the policy</span> : <span className="pill off">Not rated</span>;
  const allSel = pending.length > 0 && pending.every(r => sel.has(r.id));

  let lastMonth = '';
  return (
    <main className="page">
      <section className="head">
        <div><h1 className="title">Requests</h1><p className="lede">{ro ? 'Every request from sales to go to an external event, and what Roman decided.' : 'Every request from sales in one inbox. Check the row, then approve or decline. Click a row for the details.'}</p></div>
      </section>
      <div className="kpis">
        <div className={`kpi ${pending.length ? 'red' : ''}`}><span>Waiting for a decision</span><b className="num">{data.requests.filter(r => r.status === 'requested').length}</b><small>requests</small></div>
        <div className="kpi"><span>Approved, coming up</span><b className="num">{upcomingApproved.length}</b><small>people at {new Set(upcomingApproved.map(r => r.eventId)).size} events</small></div>
        <div className="kpi"><span>Ticket spend approved</span><b className="num">{chf(spend)}</b><small>as entered by sales</small></div>
        <div className={`kpi ${t12gaps ? 'red' : ''}`}><span>Tier 1–2 without anyone</span><b className="num">{t12gaps}</b><small>upcoming events</small></div>
        <div className="kpi"><span>Suggested events</span><b className="num">{sugs.length}</b><small>to review</small></div>
      </div>
      {ro && <div className="ro"><IcInfo s={16} />You see everything here; Roman and the events team make the decisions.</div>}
      <div className="tabs" role="tablist">
        {([['inbox', ro ? 'Waiting' : 'To decide', data.requests.filter(r => r.status === 'requested').length], ['decided', 'Decided', null], ['coverage', 'Coverage gaps', t12gaps], ['suggestions', 'Suggestions', sugs.length]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>
        ))}
      </div>

      {tab === 'inbox' && <>
        {requesters.length > 1 && <div className="toolbar"><select className="select sm" style={{ width: 240 }} value={who} onChange={e => setWho(e.target.value)} aria-label="Filter by person"><option value="">Everyone</option>{requesters.map(p => <option key={p!.id} value={p!.id}>{p!.name}</option>)}</select></div>}
        {!pending.length ? <div className="card"><Blank icon={<IcCheck s={22} />} title="Nothing waiting" text="When someone from sales requests an event, it lands here with the policy check, the cost and who else is going. Approving takes one click." /></div> : (
          <div className="card scroll-x">
            <table className="tbl">
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
                        {!ro && <td onClick={x => x.stopPropagation()}><button className={`check ${sel.has(r.id) ? 'on' : ''}`} aria-label="Select" onClick={() => setSel(s => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>{sel.has(r.id) && <IcCheck s={12} />}</button></td>}
                        <td><div className="ev"><DateBlock e={e} /><div style={{ minWidth: 0 }}><b>{e.name}</b><span>{place(e)}</span></div></div></td>
                        <td><Tier e={e} /></td>
                        <td><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Av p={p} /><div><b style={{ fontWeight: 560 }}>{p?.name}</b><div className="dim small">{p?.market || p?.team}</div></div></div></td>
                        <td className="nowrap">{MODES[r.mode][0].split(' & ')[0]}<div className="dim small">{r.meetingsPlanned} meetings</div></td>
                        <td className="r nowrap">{r.ticket === 'paid' ? chf(r.cost) : <span className="dim">{r.ticket === 'free' ? 'free' : 'covered'}</span>}</td>
                        <td>{policyChip(e)}</td>
                        <td>{others.length ? <span className="avs">{others.slice(0, 4).map(o => <Av key={o.id} p={people.get(o.personId)} req={o.status === 'requested'} size="sm" />)}</span> : <span className="dim small">no one</span>}</td>
                        {!ro && <td className="r nowrap" onClick={x => x.stopPropagation()}>
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button className="btn ok sm" disabled={busy} onClick={() => decide([r.id], 'approved', '')} aria-label={`Approve ${p?.name}`}><IcCheck s={13} />Approve</button>
                            <button className="btn line sm" disabled={busy} onClick={() => { setExp(r.id); setDeclining(r.id); }} aria-label={`Decline ${p?.name}`}><IcX s={13} /></button>
                          </span>
                        </td>}
                      </tr>
                      {exp === r.id && (
                        <tr className="detail"><td colSpan={9}>
                          <div className="grid">
                            <div>
                              <p className="lab" style={{ marginBottom: 8 }}>Why</p>
                              {r.reason ? <p className="why">{r.reason}</p> : <p className="dim">No reason given.</p>}
                              <p className="lab" style={{ margin: '16px 0 8px' }}>Wants to meet</p>
                              <div className="ctx">{r.groups.map(g => <span key={g} className="tag">{GS[g]} · fit {e.fit[g] ?? '–'}/5</span>)}</div>
                            </div>
                            <div>
                              <p className="lab" style={{ marginBottom: 8 }}>Policy · Tier {e.tk || '–'}</p>
                              <p className="muted small">{POLICY[e.tk][1]}</p>
                              <p className="lab" style={{ margin: '16px 0 8px' }}>Event</p>
                              <p className="muted small">{dateLabel(e)} · {e.audience || 'audience n/a'} · ticket {e.costTicket || 'n/a'}</p>
                              <button className="btn ghost sm" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>Open event →</button>
                            </div>
                          </div>
                          {!ro && <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                            <input className="input" style={{ flex: '1 1 260px', height: 36 }} placeholder={declining === r.id ? 'Reason for sales (optional)' : 'Note for sales (optional)'} value={note} onChange={x => setNote(x.target.value)} maxLength={1000} autoFocus={declining === r.id} />
                            <button className="btn ok" disabled={busy} onClick={() => decide([r.id], 'approved', note)}><IcCheck s={14} />Approve</button>
                            <button className="btn line" disabled={busy} onClick={() => decide([r.id], 'declined', note)}>Decline</button>
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
          <thead><tr><th>Event</th><th>Who</th><th>Decision</th><th>By</th><th>When</th><th>Note</th><th /></tr></thead>
          <tbody>{decided.map(r => {
            const e = ev.get(r.eventId); if (!e) return null;
            return (
              <tr key={r.id}>
                <td><button className="ev" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}><DateBlock e={e} /><div><b>{e.name}</b><span>{place(e)}</span></div></button></td>
                <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Av p={people.get(r.personId)} size="sm" />{people.get(r.personId)?.name}</div></td>
                <td><span className={`pill ${r.status === 'approved' ? 'ok' : 'off'}`}>{r.status === 'approved' ? 'Approved' : 'Declined'}</span></td>
                <td className="nowrap">{people.get(r.decidedBy || '')?.name || '–'}</td>
                <td className="nowrap dim">{new Date(r.decidedAt!).toLocaleDateString('de-CH')}</td>
                <td className="dim" style={{ maxWidth: 280 }}>{r.decisionNote || '–'}</td>
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
        <div className="card">{sugs.map(s => (
          <div key={s.id} className="mine" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
            <div style={{ minWidth: 0 }}><b style={{ fontSize: 15 }}>{s.name}</b>
              <div className="sub">{[s.month, s.city].filter(Boolean).join(' · ') || 'No date yet'} · {s.source === 'masterlist' ? 'comment in the masterlist' : `from ${people.get(s.by || '')?.name || 'a colleague'}`}</div>
              {s.reason && <p className="why" style={{ marginTop: 10, fontSize: 13.5 }}>{s.reason}</p>}
              {s.website && <a className="dim small" href={s.website} target="_blank" rel="noopener noreferrer">{s.website}</a>}</div>
            {!ro && <div className="side" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button className="btn ok sm" disabled={busy} onClick={() => act('suggestion_decide', { p_id: s.id, p_add: true }, 'Added to the calendar as unrated')}>Add to calendar</button>
              <Confirm label="Dismiss" sure="Yes, dismiss" className="btn line sm" disabled={busy} onYes={() => act('suggestion_decide', { p_id: s.id, p_add: false }, 'Dismissed')} />
            </div>}
          </div>
        ))}</div>
      ))}
    </main>
  );
}
