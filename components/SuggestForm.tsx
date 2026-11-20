'use client';
// Suggest an event (sales): only the name is needed, but everything else they know saves Roman the work.
// The key facts (dates, place, website) are up front; the rest folds away. Also used to improve and resend.
import { useState } from 'react';
import { useApp } from './AppProvider';
import { IcX, IcBack } from './icons';
import { SIZES, countryName, regionOf, type SugDetails } from '@/lib/model';
import { eventTz, tzLabel } from '@/lib/tz';

type Mode = 'exact' | 'month' | 'tbd';

export default function SuggestForm({ id }: { id?: string }) {
  const { close, act, busy, data, people } = useApp();
  const s = id ? data.suggestions.find(x => x.id === id) : undefined;
  const d: SugDetails = s?.details || {};
  const [f, setF] = useState(() => ({
    name: s?.name || '', mode: (d.mode || (s?.month ? 'month' : s ? 'tbd' : 'exact')) as Mode,
    start: d.start || '', end: d.end || '', startTime: d.startTime || '', endTime: d.endTime || '', month: s?.month || '',
    city: s?.city || '', country: d.country || '', website: s?.website || '', why: s?.reason || '',
    kind: d.kind || '', size: d.size || '', costTicket: d.costTicket || '', costSponsor: d.costSponsor || '', audience: d.audience || '', notes: d.notes || '',
  }));
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (x: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: x.target.value });
  const more = !!(f.kind || f.size || f.costTicket || f.costSponsor || f.audience || f.notes);

  // what Roman still has to find out himself
  const open = [
    f.mode === 'exact' ? (!f.start && 'dates') : f.mode === 'month' ? (!f.month && 'month') : 'dates',
    !f.city.trim() && 'city', !f.country.trim() && 'country', !f.website.trim() && 'website',
  ].filter(Boolean) as string[];

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.name.trim()) { setErr('Add the event name.'); return; }
    if (f.website.trim() && !/^https?:\/\/\S+$/i.test(f.website.trim())) { setErr('The website should start with https://'); return; }
    if (f.mode === 'exact' && f.end && f.start && f.end < f.start) { setErr('The end date is before the start.'); return; }
    if (f.mode === 'exact' && f.startTime && f.endTime && (!f.end || f.end === f.start) && f.endTime <= f.startTime) { setErr('The end time is before the start time.'); return; }
    const exact = f.mode === 'exact' && !!f.start;
    const p_details: SugDetails = {
      mode: f.mode, ...(exact ? { start: f.start, end: f.end || f.start, startTime: f.startTime, endTime: f.endTime } : {}),
      country: f.country.trim(), region: regionOf(f.country.trim()), kind: f.kind.trim(), size: f.size, costTicket: f.costTicket.trim(),
      costSponsor: f.costSponsor.trim(), audience: f.audience.trim(), notes: f.notes.trim(),
    };
    const args = { p_name: f.name.trim(), p_month: f.mode === 'month' ? f.month : '', p_city: f.city.trim(), p_website: f.website.trim(), p_reason: f.why.trim(), p_details };
    const r = s ? await act('suggestion_update', { p_id: s.id, ...args }, s.status === 'dismissed' ? 'Sent to Roman again' : 'Suggestion updated')
      : await act('suggestion_create', args, 'Sent to Roman');
    if (r.ok) close(); else setErr(r.error || '');
  }

  const tz = eventTz({ city: f.city, country: f.country || 'TBA' });
  return (
    <>
      <header className="dr-h">
        <div className="dr-top"><span /><button className="icon" onClick={close} aria-label="Close"><IcX /></button></div>
        <h2 className="title">{s ? 'Improve your ' : 'Suggest an '}<em style={{ fontStyle: 'normal', color: 'var(--red)' }}>event</em></h2>
        <p className="muted">Only the name is needed. Everything else you know saves Roman the research.</p>
      </header>
      <form className="dr-b" id="sugForm" onSubmit={submit} noValidate>
        {s?.status === 'dismissed' && s.decisionNote && <div className="q"><p className="why"><b>{people.get(s.decidedBy || '')?.name || 'Roman'}:</b> {s.decisionNote}</p></div>}
        <div className="q"><div className="field"><label htmlFor="sname">Event name</label><input id="sname" className="input" value={f.name} onChange={set('name')} maxLength={200} data-autofocus /></div></div>

        <div className="q">
          <div className="field" style={{ marginBottom: 12 }}><span className="fl">When</span>
            <div className="seg">{([['exact', 'Exact dates'], ['month', 'Month'], ['tbd', 'Not sure yet']] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={f.mode === k} onClick={() => setF({ ...f, mode: k })}>{l}</button>)}</div></div>
          {f.mode === 'exact' && <>
            <div className="row2"><div className="field"><label htmlFor="ss">Start</label><input id="ss" className="input" type="date" value={f.start} onChange={set('start')} /></div><div className="field"><label htmlFor="se">End</label><input id="se" className="input" type="date" value={f.end} onChange={set('end')} /></div></div>
            <div className="row2" style={{ marginTop: 10 }}><div className="field"><label htmlFor="sst">Starts at <span className="dim">(optional)</span></label><input id="sst" className="input" type="time" value={f.startTime} onChange={set('startTime')} /></div><div className="field"><label htmlFor="set">Ends at <span className="dim">(optional)</span></label><input id="set" className="input" type="time" value={f.endTime} onChange={set('endTime')} /></div></div>
            {(f.startTime || f.endTime) && <span className="dim small">{tz.guessed ? 'Local time at the event.' : `Local time at the event (${tzLabel(tz.tz)}).`}</span>}
          </>}
          {f.mode === 'month' && <div className="field"><label htmlFor="smonth">Month</label><input id="smonth" className="input" type="month" value={f.month} onChange={set('month')} /></div>}
        </div>

        <div className="q"><div className="row2">
          <div className="field"><label htmlFor="scity">City</label><input id="scity" className="input" value={f.city} onChange={set('city')} maxLength={120} /></div>
          <div className="field"><label htmlFor="scountry">Country</label><input id="scountry" className="input" value={f.country} onChange={set('country')} maxLength={40} placeholder="Portugal, CH, UK…" />{f.country.trim() && countryName(f.country) !== f.country.trim() && <span className="dim small">Shown as: {countryName(f.country) || '–'}</span>}</div>
        </div></div>
        <div className="q"><div className="field"><label htmlFor="sweb">Website</label><input id="sweb" className="input" type="url" value={f.website} onChange={set('website')} placeholder="https://" maxLength={500} /></div></div>
        <div className="q"><div className="field"><label htmlFor="swhy">Why should Bitcoin Suisse be there?</label><textarea id="swhy" className="area" value={f.why} onChange={set('why')} maxLength={2000} placeholder="Who you would meet, what it could bring" /></div></div>

        <details className="more q" open={more}>
          <summary>More details (optional)</summary>
          <div className="row2">
            <div className="field"><label htmlFor="skind">Type</label><input id="skind" className="input" value={f.kind} onChange={set('kind')} maxLength={120} placeholder="Crypto, TradFi, Family office…" /></div>
            <div className="field"><label htmlFor="ssize">Audience size</label><select id="ssize" className="select" value={f.size} onChange={set('size')}><option value="">Don’t know</option>{SIZES.map(z => <option key={z}>{z}</option>)}</select></div>
          </div>
          <div className="row2" style={{ marginTop: 10 }}>
            <div className="field"><label htmlFor="sticket">Ticket price</label><input id="sticket" className="input" value={f.costTicket} onChange={set('costTicket')} maxLength={300} placeholder="e.g. EUR 900, free for investors" /></div>
            <div className="field"><label htmlFor="ssponsor">Sponsoring</label><input id="ssponsor" className="input" value={f.costSponsor} onChange={set('costSponsor')} maxLength={400} placeholder="Packages, if you know" /></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor="saud">Who goes there</label><input id="saud" className="input" value={f.audience} onChange={set('audience')} maxLength={300} placeholder="Family offices, founders, banks…" /></div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor="snotes">Anything else for Roman</label><textarea id="snotes" className="area" value={f.notes} onChange={set('notes')} maxLength={2000} placeholder="Speaker slot, side events, who you know there…" /></div>
        </details>

        <div className="q">
          <p className="small" style={{ margin: 0, color: open.length ? 'var(--ink-2)' : 'var(--ok)' }}>{open.length ? <>Still open: <b>{open.join(', ')}</b>. Fill in what you know; Roman may ask for the rest.</> : 'All key facts are in. Roman can add it right away.'}</p>
          {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
        </div>
      </form>
      <footer className="dr-f">
        {s && <button type="button" className="btn ghost" onClick={close}><IcBack s={14} />Cancel</button>}
        <button type="submit" form="sugForm" className="btn red lg" disabled={busy}>{s?.status === 'dismissed' ? 'Send to Roman again' : s ? 'Save changes' : 'Send to Roman'}</button>
      </footer>
    </>
  );
}
