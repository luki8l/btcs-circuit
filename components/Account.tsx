'use client';
// Your account: who you are in Circuit, and your own password.
import { useActionState, useEffect, useRef } from 'react';
import { useApp } from './AppProvider';
import { changePassword, type PwState } from '@/app/(app)/account/actions';
import { ROLE_LABEL } from '@/lib/model';

export default function Account() {
  const { me, toast } = useApp();
  const [st, run, pending] = useActionState<PwState, FormData>(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (st?.ok) { toast('Password changed. Use the new one next time you sign in.'); form.current?.reset(); } }, [st, toast]);
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <section className="head"><div><h1 className="title">Your account</h1><p className="lede">You stay signed in on this device. Your password is only needed on a new device or browser.</p></div></section>
      <div className="card acct">
        <dl>
          <div><dt>Name</dt><dd>{me.name}</dd></div>
          <div><dt>E-mail</dt><dd>{me.email}</dd></div>
          <div><dt>Role</dt><dd>{ROLE_LABEL[me.role]}{me.team ? ` · ${me.team}` : ''}{me.market ? ` · ${me.market}` : ''}</dd></div>
        </dl>
      </div>
      <div className="card acct">
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
          {st?.ok && <p className="ok-t" role="status">Done. Your new password is active.</p>}
          <div><button className="btn red" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button></div>
        </form>
      </div>
    </main>
  );
}
