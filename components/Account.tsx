'use client';
// Your account: who you are in Circuit, your own password (or Microsoft sign-in), and your devices.
import { useActionState, useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { changePassword, signOutOthers, type PwState } from '@/app/(app)/account/actions';
import { ROLE_LABEL } from '@/lib/model';

export default function Account({ microsoft = false }: { microsoft?: boolean }) {
  const { me, toast } = useApp();
  const [st, run, pending] = useActionState<PwState, FormData>(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  const [out, setOut] = useState<'idle' | 'busy' | 'done'>('idle');
  async function others() {
    setOut('busy');
    const r = await signOutOthers();
    if (r?.ok) { setOut('done'); toast('Signed out on all other devices.'); } else { setOut('idle'); toast(r?.err || 'That did not work. Try again.', true); }
  }
  useEffect(() => { if (st?.ok) { toast('Password changed. Use the new one next time you sign in.'); form.current?.reset(); } }, [st, toast]);
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <section className="head"><div><h1 className="title">Your account</h1><p className="lede">{microsoft ? 'You sign in with your Bitcoin Suisse Microsoft account.' : 'You stay signed in on this device. Your password is only needed on a new device or browser.'}</p></div></section>
      <div className="card acct">
        <dl>
          <div><dt>Name</dt><dd>{me.name}</dd></div>
          <div><dt>E-mail</dt><dd>{me.email}</dd></div>
          <div><dt>Role</dt><dd>{ROLE_LABEL[me.role]}{me.team ? ` · ${me.team}` : ''}{me.market ? ` · ${me.market}` : ''}</dd></div>
        </dl>
      </div>
      {!microsoft && <div className="card acct">
        <h2 className="h2">Change password</h2>
        <p className="muted small" style={{ margin: '4px 0 16px' }}>At least 8 characters. A short sentence is easy to remember and hard to guess.</p>
        <form ref={form} action={run} className="acct-f">
          <label htmlFor="cur">Current password</label>
          <input id="cur" name="current" type="password" className="input" autoComplete="current-password" required />
          <label htmlFor="pw">New password</label>
          <input id="pw" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
          <label htmlFor="pw2">New password again</label>
          <input id="pw2" name="again" type="password" className="input" autoComplete="new-password" minLength={8} required />
          {st?.err && <p className="err" role="alert">{st.err}</p>}
          {st?.ok && <p className="ok-t" role="status">Done. Your new password is active. Other devices need to sign in again.</p>}
          <div><button className="btn red" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button></div>
        </form>
      </div>}
      <div className="card acct">
        <h2 className="h2">Devices</h2>
        <p className="muted small" style={{ margin: '4px 0 16px' }}>Lost a phone or signed in on a shared computer? Sign out everywhere else. This browser stays signed in.</p>
        <div><button className="btn ghost" onClick={others} disabled={out !== 'idle'}>{out === 'busy' ? 'Signing out…' : out === 'done' ? 'Signed out on other devices' : 'Sign out on all other devices'}</button></div>
      </div>
    </main>
  );
}
