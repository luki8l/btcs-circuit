'use client';
// Management view: where Bitcoin Suisse shows up, what it costs and what comes back.
import { useApp, h } from './AppProvider';
import { Tier, DateBlock, Av } from './ui';
import { IcInfo } from './icons';
import { MS, ML, REGIONS, REGION_LABEL, chf, dateLabel, mIdx, canSeeInsights } from '@/lib/model';

export default function Insights() {
  const { me, data, ev, events, people, presence, open, today } = useApp();
  if (!canSeeInsights(me.role)) return <main className="page"><h1 className="title">Insights</h1><p className="muted" style={{ marginTop: 12 }}>Insights are for the events team and management.</p></main>;
  const rs = data.requests.filter(r => r.status !== 'withdrawn' && ev.has(r.eventId));
  const appr = rs.filter(r => r.status === 'approved');
  const att = appr.filter(r => ev.get(r.eventId)!.past || (ev.get(r.eventId)!.sd && ev.get(r.eventId)!.sd! <= today));
  const deb = att.filter(r => r.rating);
  const leads = deb.reduce((a, r) => a + (r.leads || 0), 0);
  const spendDeb = deb.reduce((a, r) => a + Number(r.cost || 0), 0);
  const spend = appr.reduce((a, r) => a + Number(r.cost || 0), 0);
  const t12 = events.filter(e => !e.past && e.mode !== 'tbd' && (e.tk === 1 || e.tk === 2));
  const cov = t12.filter(e => presence(e.id).approved.length);
  const pct = t12.length ? Math.round(cov.length / t12.length * 100) : 0;
  const evs = new Set(appr.map(r => r.eventId));

  const dated = events.filter(e => e.sd && e.mode !== 'tbd');
  const m0 = Math.min(...dated.map(e => mIdx(e.sd!))), m1 = Math.max(...dated.map(e => mIdx(e.sd!)));
  const cols: number[] = []; for (let m = m0; m <= m1; m++) cols.push(m);
  const cnt = (m: number, st: string) => rs.filter(r => r.status === st && ev.get(r.eventId)!.sd && ev.get(r.eventId)!.mode !== 'tbd' && mIdx(ev.get(r.eventId)!.sd!) === m).length;
  const maxc = Math.max(1, ...cols.map(m => cnt(m, 'approved') + cnt(m, 'requested')));
  const F: [string, number][] = [['Requests', rs.length], ['Approved', appr.length], ['Attended', att.length], ['Debriefed', deb.length]];
  const regs = REGIONS.filter(r => r !== 'Other').map(rg => { const up = events.filter(e => !e.past && e.reg === rg && e.tk >= 1 && e.tk <= 3); return [rg, up.filter(e => presence(e.id).approved.length).length, up.length] as const; });
  const results = att.slice().sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1));
  const ppl = data.people.filter(p => rs.some(r => r.personId === p.id)).map(p => {
    const mine = rs.filter(r => r.personId === p.id);
    return { p, req: mine.length, ok: mine.filter(r => r.status === 'approved').length, leads: mine.reduce((a, r) => a + (r.leads || 0), 0), cost: mine.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.cost || 0), 0) };
  }).sort((a, b) => b.leads - a.leads || b.ok - a.ok);
  const tierRes = [1, 2, 3, 4, 5].map(t => { const d = deb.filter(r => ev.get(r.eventId)!.tk === t); return [t, d.length, d.length ? d.reduce((a, r) => a + (r.leads || 0), 0) / d.length : 0, d.length ? d.reduce((a, r) => a + (r.rating || 0), 0) / d.length : 0] as const; });
  const maxTierLeads = Math.max(1, ...tierRes.map(t => t[2]));

  return (
    <main className="page">
      <section className="head">
        <div><p className="k">Management</p><h1 className="title">What the circuit <em>brings</em>.</h1>
          <p className="lede">Where Bitcoin Suisse shows up, what it costs and what comes back. Leads come from the sales debriefs today and straight from HubSpot in phase 2.</p></div>
      </section>
      <div className="kpis">
        <div className="kpi"><span>Events with Bitcoin Suisse</span><b className="num">{evs.size}</b><small>{new Set(att.map(r => r.eventId)).size} done · {evs.size - new Set(att.map(r => r.eventId)).size} ahead</small></div>
        <div className={`kpi ${pct < 50 ? 'red' : ''}`}><span>Tier 1–2 coverage</span><b className="num">{pct}%</b><small>{cov.length} of {t12.length} upcoming</small></div>
        <div className="kpi"><span>Waiting for decision</span><b className="num">{rs.filter(r => r.status === 'requested').length}</b><small>requests</small></div>
        <div className="kpi"><span>Ticket spend approved</span><b className="num">{chf(spend)}</b><small>entered by sales</small></div>
        <div className="kpi"><span>Leads logged</span><b className="num">{leads}</b><small>from {deb.length} debriefs</small></div>
        <div className="kpi"><span>Ticket cost per lead</span><b className="num">{leads ? chf(spendDeb / leads) : '–'}</b><small>debriefed events</small></div>
      </div>

      <div className="charts">
        <div className="panel">
          <div className="panel-h"><div><h2 className="h2">Presence by month</h2><p>Requests by event month, {MS[m0 % 12]} {Math.floor(m0 / 12)} – {MS[m1 % 12]} {Math.floor(m1 / 12)}</p></div>
            <div className="legend"><span><i className="lg-dot" style={{ background: 'var(--red)', borderRadius: 0 }} />Approved</span><span><i className="lg-ring req" style={{ borderRadius: 0 }} />Waiting</span></div></div>
          <div className="mbar">{cols.map(m => {
            const a = cnt(m, 'approved'), q = cnt(m, 'requested'), sc = 150 / maxc;
            return (
              <div key={m} className="col" data-tip={`<b>${ML[m % 12]} ${Math.floor(m / 12)}</b>${a} approved · ${q} waiting`}>
                {a > 0 && <i className="a" style={{ height: a * sc }} />}{q > 0 && <i className="q" style={{ height: q * sc }} />}
                {a + q > 0 && <span className="v">{a + q}</span>}
              </div>
            );
          })}</div>
          <div className="mlabs">{cols.map(m => <span key={m}>{MS[m % 12].slice(0, 3)}{m % 12 === 0 || m === m0 ? <><br />{String(Math.floor(m / 12)).slice(2)}</> : null}</span>)}</div>
        </div>
        <div className="panel">
          <div className="panel-h"><div><h2 className="h2">From request to result</h2><p>Requests at each stage</p></div></div>
          <div className="hbars">{F.map(([l, v]) => <div key={l} className="hbar"><span>{l}</span><span className="track"><i style={{ width: `${v / Math.max(1, F[0][1]) * 100}%` }} /></span><b>{v}</b></div>)}</div>
          <div className="panel-h" style={{ marginTop: 26 }}><div><h2 className="h2">Coverage by region</h2><p>Upcoming Tier 1–3 events with someone approved</p></div></div>
          <div className="hbars">{regs.map(([rg, c, t]) => <div key={rg} className="hbar" data-tip={`${h(REGION_LABEL[rg])}: ${c} of ${t} covered`}><span>{REGION_LABEL[rg]}</span><span className="track"><i style={{ width: `${t ? c / t * 100 : 0}%` }} /></span><b>{c} / {t}</b></div>)}</div>
        </div>
      </div>

      <section className="sect">
        <h2 className="h2">Event results</h2><p className="lede">Attended events, ranked by leads. Rating and “go again?” replace the yearly gut-feeling round for the 2028 tiers.</p>
        <div className="card scroll-x">{results.length ? (
          <table className="tbl">
            <thead><tr><th>Event</th><th>Tier</th><th>Who</th><th className="r">Ticket</th><th className="r">Leads</th><th className="r">Per lead</th><th>Rating</th><th>Again?</th></tr></thead>
            <tbody>{results.map(r => {
              const e = ev.get(r.eventId)!, cpl = r.rating && r.leads ? Number(r.cost || 0) / r.leads : null;
              return (
                <tr key={r.id} className="click" onClick={() => open({ kind: 'event', id: e.id, view: 'detail' })}>
                  <td><div className="ev"><DateBlock e={e} /><div><b>{e.name}</b><span>{dateLabel(e)}</span></div></div></td>
                  <td><Tier e={e} /></td>
                  <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Av p={people.get(r.personId)} size="sm" /><span className="nowrap">{people.get(r.personId)?.name}</span></div></td>
                  <td className="r">{r.cost ? chf(r.cost) : <span className="dim">free</span>}</td>
                  <td className="r">{r.rating ? <b className="num" style={{ fontSize: 20 }}>{r.leads}</b> : <span className="pill red">debrief due</span>}</td>
                  <td className="r">{cpl != null ? chf(cpl) : <span className="dim">–</span>}</td>
                  <td>{r.rating ? <span className="dots5">{'●'.repeat(r.rating)}<em>{'●'.repeat(5 - r.rating)}</em></span> : null}</td>
                  <td>{r.goAgain && <span className={`pill ${r.goAgain === 'yes' ? 'ok' : r.goAgain === 'no' ? 'red' : ''}`}>{r.goAgain}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>) : <div className="empty">No attended events yet. Results show up after the first debrief.</div>}</div>
      </section>

      <div className="charts" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="panel">
          <div className="panel-h"><div><h2 className="h2">Leads per event, by tier</h2><p>Does the tier predict results? Average over debriefed events.</p></div></div>
          <div className="hbars">{tierRes.map(([t, n, avg, rt]) => <div key={t} className="hbar" style={{ gridTemplateColumns: '60px minmax(0,1fr) 120px' }} data-tip={`Tier ${t}: ${n} debriefed`}><span><Tier e={{ tk: t }} /></span><span className="track"><i style={{ width: `${avg / maxTierLeads * 100}%` }} /></span><b>{n ? `${avg.toFixed(1)} leads · ${rt.toFixed(1)}★` : <span className="dim">no data</span>}</b></div>)}</div>
        </div>
        <div className="panel">
          <div className="panel-h"><div><h2 className="h2">People</h2><p>Requests, approvals, leads and ticket spend per person</p></div></div>
          {ppl.length ? <table className="tbl" style={{ fontSize: 13 }}><thead><tr><th>Person</th><th className="r">Req.</th><th className="r">Approved</th><th className="r">Leads</th><th className="r">Spend</th></tr></thead>
            <tbody>{ppl.map(x => <tr key={x.p.id}><td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Av p={x.p} size="sm" />{x.p.name}</div></td><td className="r">{x.req}</td><td className="r">{x.ok}</td><td className="r">{x.leads}</td><td className="r">{chf(x.cost)}</td></tr>)}</tbody></table>
            : <div className="empty">No requests yet.</div>}
        </div>
      </div>

      <div className="callout"><IcInfo /><span><b style={{ color: 'var(--ink)' }}>Phase 2 · HubSpot.</b> On approval Circuit creates the event in HubSpot; leads, deals and onboarded clients flow back per event. Then conversion and AuM per event are measured, not typed in.</span></div>
    </main>
  );
}
