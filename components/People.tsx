'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { Av } from './ui';
import { IcPlus, IcLink, IcCheck } from './icons';
import { ROLE_LABEL, ROLE_HINT, type Role, type Person } from '@/lib/model';
import { createPerson, newLink, savePerson, type Res } from '@/app/(app)/people/actions';

export type AdminPerson = Person & { email: string; createdAt: string; lastSignIn: string | null };
export type Act = { at: string; actor: string | null; action: string; eventId: number | null; requestId: string | null; details: Record<string, unknown> };
const ROLES: Role[] = ['sales', 'events', 'management', 'admin'];
const MARKETS = ['Austria', 'Germany', 'Liechtenstein', 'Netherlands', 'Portugal', 'Sweden', 'Switzerland', 'Spain', 'France', 'Italy', 'United Kingdom', 'Denmark', 'Norway', 'Finland'];
const VERB: Record<string, string> = { request: 'requested', request_edit: 'changed the request for', withdraw: 'withdrew from', approved: 'approved a request for', declined: 'declined a request for', reopen: 'reopened a request for', assign: 'sent someone to', hubspot: 'logged in HubSpot', hubspot_undo: 'undid HubSpot for', debrief: 'debriefed', flag: 'flagged', unflag: 'removed the flag on', suggest: 'suggested', suggestion_added: 'added a suggestion:', suggestion_dismissed: 'dismissed a suggestion:', event_create: 'added the event', event_edit: 'edited', event_archive: 'archived', event_restore: 'restored', person_save: 'changed an account', hubspot_created: 'created in HubSpot:', hubspot_linked: 'linked to HubSpot:', hubspot_updated: 'updated in HubSpot:', hubspot_unlinked: 'unlinked from HubSpot:' };

export default function People({ people, feed, secretKey }: { people: AdminPerson[]; feed: Act[]; secretKey: boolean }) {
  const { me, ev, people: pm, toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: '', email: '', role: 'sales' as Role, market: '', team: '', title: '' });
  const [res, setRes] = useState<Res | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminPerson | null>(null);
  const [q, setQ] = useState('');
  const teams = [...new Set(people.map(p => p.team).filter(Boolean))];
  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => { const r = await createPerson(form); setRes(r); if (r.ok) { setForm({ name: '', email: '', role: form.role, market: '', team: form.team, title: '' }); router.refresh(); } });
  }
  function save() {
    if (!draft) return;
    start(async () => { const r = await savePerson(draft); if (r.ok) { toast('Saved'); setEdit(null); router.refresh(); } else toast(r.err || 'Not saved', true); });
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); toast('Link copied'); } catch { toast('Select the link and copy it', true); } }
  const shown = people.filter(p => !q || (p.name + p.email + p.market + p.team + p.role).toLowerCase().includes(q.toLowerCase()));
  const describe = (a: Act) => {
    const who = pm.get(a.actor || '')?.name || people.find(p => p.id === a.actor)?.name || 'Someone';
    const e = a.eventId ? ev.get(a.eventId)?.name : null;
    const n = typeof a.details?.name === 'string' ? a.details.name : null;
    return <><b>{who}</b> {VERB[a.action] || a.action} {e ? <b>{e}</b> : n ? <b>{n}</b> : null}{a.action === 'debrief' && a.details?.leads != null ? ` · ${a.details.leads} leads` : ''}</>;
  };
  return (
    <main className="page">
      <section className="head">
        <div><p className="k">Admin</p><h1 className="title">People &amp; <em>access</em>.</h1><p className="lede">Every colleague gets their own account. Add them here, send them their sign-in link (Teams or e-mail), and they choose a password.</p></div>
        <div className="stats">
          {ROLES.map(r => <div key={r} className="stat"><b className="num">{people.filter(p => p.role === r && p.active).length}</b><span>{ROLE_LABEL[r]}</span></div>)}
        </div>
      </section>

      <section className="sect">
        <h2 className="h2">Add a person</h2>
        <p className="lede">Roles: {ROLES.map(r => `${ROLE_LABEL[r]} (${ROLE_HINT[r].toLowerCase()})`).join(' · ')}.</p>
        {!secretKey && <p className="err" style={{ marginBottom: 10 }}>SUPABASE_SECRET_KEY is not set in Vercel, so new accounts can’t be created yet.</p>}
        <form className="panel" onSubmit={add}>
          <div className="row3">
            <div className="field"><label htmlFor="pn">Name</label><input id="pn" className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="First Last" /></div>
            <div className="field"><label htmlFor="pe">Work e-mail</label><input id="pe" className="input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength={200} placeholder="name@bitcoinsuisse.com" /></div>
            <div className="field"><label htmlFor="pr">Role</label><select id="pr" className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          </div>
          <div className="row3" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="pm">Market</label><input id="pm" className="input" list="markets" value={form.market} onChange={e => setForm({ ...form, market: e.target.value })} maxLength={60} /><datalist id="markets">{MARKETS.map(m => <option key={m} value={m} />)}</datalist></div>
            <div className="field"><label htmlFor="pt">Team</label><input id="pt" className="input" list="teams" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} maxLength={60} placeholder="DACH, Nordics…" /><datalist id="teams">{teams.map(m => <option key={m} value={m} />)}</datalist></div>
            <div className="field"><label htmlFor="pti">Title</label><input id="pti" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Relationship Manager" /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn red" disabled={pending || !secretKey}><IcPlus />{pending ? 'Creating…' : 'Create account'}</button>
            {res?.err && <span className="err">{res.err}</span>}
          </div>
          {res?.link && (
            <div className="banner" style={{ borderColor: 'var(--line-2)', background: 'var(--ok-soft)', flexDirection: 'column', gap: 10 }}>
              <span><IcCheck s={14} /> <b>Account ready for {res.email}.</b> Send this sign-in link. It works once, for 24 hours, and lets them choose a password.</span>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}><input className="input" readOnly value={res.link} onFocus={e => e.target.select()} aria-label="Sign-in link" /><button type="button" className="btn white" onClick={() => copy(res.link!)}><IcLink />Copy</button></div>
            </div>
          )}
        </form>
      </section>

      <section className="sect">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 className="h2">Accounts <span className="tag">{people.length}</span></h2>
          <input className="input" style={{ width: 260, height: 34 }} placeholder="Search people" value={q} onChange={e => setQ(e.target.value)} aria-label="Search people" />
        </div>
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Person</th><th>Role</th><th>Market</th><th>Team</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>{shown.map(p => edit === p.id && draft ? (
              <tr key={p.id} className="sel">
                <td><input className="input" style={{ height: 34 }} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} aria-label="Name" /><div className="dim small" style={{ marginTop: 4 }}>{p.email}</div></td>
                <td><select className="select sm" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Role })} disabled={p.id === me.id} aria-label="Role">{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                <td><input className="input" style={{ height: 34 }} list="markets" value={draft.market} onChange={e => setDraft({ ...draft, market: e.target.value })} aria-label="Market" /></td>
                <td><input className="input" style={{ height: 34 }} list="teams" value={draft.team} onChange={e => setDraft({ ...draft, team: e.target.value })} aria-label="Team" /></td>
                <td><input className="input" style={{ height: 34 }} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} aria-label="Title" placeholder="Title" /></td>
                <td><button className="chip" aria-pressed={draft.active} disabled={p.id === me.id} onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? 'Active' : 'Deactivated'}</button></td>
                <td className="r nowrap"><button className="btn red sm" disabled={pending} onClick={save}>Save</button> <button className="btn ghost sm" onClick={() => setEdit(null)}>Cancel</button></td>
              </tr>
            ) : (
              <tr key={p.id} style={p.active ? undefined : { opacity: .5 }}>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Av p={p} /><div><b style={{ fontWeight: 560 }}>{p.name}{p.id === me.id ? ' (you)' : ''}</b><div className="dim small">{p.email}{p.title ? ` · ${p.title}` : ''}</div></div></div></td>
                <td><span className={`pill ${p.role === 'admin' ? 'red' : p.role === 'events' ? 'wait' : ''}`}>{ROLE_LABEL[p.role]}</span></td>
                <td>{p.market || <span className="dim">–</span>}</td>
                <td>{p.team || <span className="dim">–</span>}</td>
                <td className="dim nowrap">{p.lastSignIn ? new Date(p.lastSignIn).toLocaleDateString('de-CH') : 'never'}</td>
                <td>{p.active ? <span className="pill ok"><i />Active</span> : <span className="pill off">Deactivated</span>}</td>
                <td className="r nowrap">
                  <button className="btn ghost sm" disabled={pending || !secretKey} onClick={() => start(async () => { const r = await newLink(p.email, p.id); setRes(r); if (r.link) { copy(r.link); window.scrollTo({ top: 0, behavior: 'smooth' }); } else if (r.err) toast(r.err, true); })}><IcLink s={13} />Sign-in link</button>
                  <button className="btn line sm" onClick={() => { setEdit(p.id); setDraft(p); }}>Edit</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="sect">
        <h2 className="h2">Activity</h2><p className="lede">The last 80 changes. Kept in the database, can’t be edited.</p>
        <div className="card">{feed.length ? feed.map((a, i) => (
          <div key={i} className="mine" style={{ gridTemplateColumns: '150px minmax(0,1fr)', padding: '10px 16px' }}><span className="dim small">{new Date(a.at).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}</span><span className="small">{describe(a)}</span></div>
        )) : <div className="empty">Nothing yet.</div>}</div>
      </section>
    </main>
  );
}
