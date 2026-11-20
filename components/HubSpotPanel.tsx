'use client';
// Roman's / admin's view of an event in HubSpot: what would go over (read only until a button is pressed),
// look-alikes already in HubSpot, and create / link / update / unlink.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { Confirm } from './ui';
import { IcExt, IcCheck, IcWarn } from './icons';
import { fmtIn } from '@/lib/tz';
import type { Ev } from '@/lib/model';

type Field = { key: string; label: string; value: string };
type Rec = { id: string; url: string; props: Record<string, string | null>; exact?: boolean; linkedTo?: string | null };
type Preview = { fields: Field[]; tz: string; notes: string[]; linked: Rec | null; linkedMissing?: boolean; candidates: Rec[]; auto: boolean };
const isDate = (k: string) => k.endsWith('_date');

export default function HubSpotPanel({ e }: { e: Ev }) {
  const { toast, presence } = useApp();
  const going = presence(e.id).approved.length;
  const router = useRouter();
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [twin, setTwin] = useState(false);

  async function call(action: 'preview' | 'create' | 'link' | 'update' | 'unlink', extra: Record<string, unknown> = {}) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/hubspot/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: e.id, action, ...extra }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 409 && j.candidate) setTwin(true);
        setErr(j.error + (j.missingScopes ? ` (missing: ${j.missingScopes.join(', ')})` : '') || 'That did not work.');
        return null;
      }
      return j;
    } catch { setErr('No connection. Try again.'); return null; }
    finally { setBusy(false); }
  }
  const preview = async () => { const j = await call('preview'); if (j) setPv(j); };
  const write = async (action: 'create' | 'link' | 'update' | 'unlink', msg: string, extra?: Record<string, unknown>) => {
    const j = await call(action, extra);
    if (!j) return;
    toast(msg); setPv(null); setTwin(false); router.refresh();
  };
  const show = (k: string, v: string | null | undefined, tz: string) => (isDate(k) ? fmtIn(v, tz) : v) || <span className="dim">empty</span>;
  const same = (f: Field) => { const now = pv?.linked?.props[f.key] || ''; return isDate(f.key) ? (now ? new Date(now).getTime() : 0) === (f.value ? new Date(f.value).getTime() : 0) : now === f.value; };
  const upToDate = !!pv?.linked && pv.fields.every(same);

  return (
    <div className="hs">
      <p className="hs-state">
        {e.hubspotId ? <><span className="pill ok"><IcCheck s={12} />In HubSpot</span><span className="dim small">last sent {e.hubspotSyncedAt ? new Date(e.hubspotSyncedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></>
          : <span className="dim small">Not in HubSpot yet.</span>}
        {!pv && <button className="btn line sm" disabled={busy} onClick={preview} style={{ marginLeft: 'auto' }}>{busy ? 'Checking…' : e.hubspotId ? 'Check HubSpot' : 'Prepare for HubSpot'}</button>}
      </p>
      {err && <p className="err small">{err}</p>}
      {pv && <>
        <table className="tbl hs-t">
          <thead><tr><th>HubSpot field</th><th>{pv.linked ? 'From Circuit' : 'Will be sent'}</th>{pv.linked && <th>Now in HubSpot</th>}</tr></thead>
          <tbody>{pv.fields.map(f => {
            const now = pv.linked?.props[f.key] ?? null;
            return <tr key={f.key}><td className="dim">{f.label}</td><td>{show(f.key, f.value, pv.tz)}</td>{pv.linked && <td className={same(f) ? 'dim' : 'hs-diff'}>{show(f.key, now, pv.tz)}</td>}</tr>;
          })}</tbody>
        </table>
        <ul className="hs-notes">{pv.notes.map(n => <li key={n}>{n}</li>)}</ul>
        <p className="dim small">{pv.auto
          ? (e.hubspotId ? 'Automatic: when you edit this event, HubSpot is updated.' : going ? 'Automatic: this goes to HubSpot when someone is approved. If it did not, create it here.' : 'Automatic: this goes to HubSpot as soon as you approve someone for it.')
          : 'Automatic sync is off: nothing goes to HubSpot unless you press a button here.'}</p>

        {pv.linked && <div className="hs-act">
          <a className="btn ghost sm" href={pv.linked.url} target="_blank" rel="noopener noreferrer">Open in HubSpot <IcExt s={13} /></a>
          {upToDate ? <span className="dim small">HubSpot is up to date.</span>
            : <Confirm className="btn sm" label="Update in HubSpot" sure="Yes, overwrite the fields in red" disabled={busy} onYes={() => write('update', 'Updated in HubSpot')} />}
          <Confirm label="Unlink" sure="Yes, unlink (HubSpot keeps it)" disabled={busy} onYes={() => write('unlink', 'Unlinked from HubSpot')} />
        </div>}
        {pv.linkedMissing && <div className="hs-act"><span className="err small"><IcWarn s={13} /> The linked HubSpot event was deleted there.</span><Confirm label="Unlink" sure="Yes, unlink" disabled={busy} onYes={() => write('unlink', 'Unlinked from HubSpot')} /></div>}

        {!e.hubspotId && <>
          {pv.candidates.length > 0 && <div className="hs-cands">
            <p className="lab">Already in HubSpot?</p>
            {pv.candidates.map(c => <div className="hs-c" key={c.id}>
              <div><b>{c.props.event_name}</b>{c.exact && <span className="tag">Same name{c.props.event_start_date ? ' and date' : ''}</span>}
                <small className="dim">{[c.props.event_location, fmtIn(c.props.event_start_date, pv.tz)].filter(Boolean).join(' · ') || 'no place or date'}</small></div>
              <span className="hs-c-a"><a className="btn ghost sm" href={c.url} target="_blank" rel="noopener noreferrer">Open <IcExt s={13} /></a>
                {c.linkedTo ? <span className="dim small">linked to {c.linkedTo}</span> : <button className="btn line sm" disabled={busy} onClick={() => write('link', 'Linked to the HubSpot event', { hubspotId: c.id })}>Link this one</button>}</span>
            </div>)}
          </div>}
          <div className="hs-act">
            {pv.auto && !going ? null : (twin || pv.candidates.some(c => c.exact && !c.linkedTo))
              ? <Confirm className="btn line sm" label="Create a new one anyway" sure="Yes, create a second one" disabled={busy} onYes={() => write('create', 'Created in HubSpot', { force: true })} />
              : <Confirm className="btn sm" label="Create in HubSpot" sure="Yes, create it in HubSpot" disabled={busy} onYes={() => write('create', 'Created in HubSpot')} />}
            <button className="btn ghost sm" onClick={() => { setPv(null); setErr(''); }}>Close</button>
          </div>
        </>}
      </>}
    </div>
  );
}
