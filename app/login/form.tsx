'use client';
import { useActionState, useEffect } from 'react';
import { signIn, setPassword, type SignInState } from './actions';

/** only a path on this site (not //other.site or a backslash variant): anything else goes home */
function sameSite(next: string) {
  try { const u = new URL(next, location.origin); return u.origin === location.origin ? u.pathname + u.search + u.hash : '/'; } catch { return '/'; }
}

export function LoginForm({ next }: { next: string }) {
  const [res, action, pending] = useActionState<SignInState, FormData>(signIn, null);
  const ok = !!res?.ok;
  useEffect(() => { if (ok) window.location.assign(sameSite(next)); }, [ok, next]);
  return (
    <form action={action} className="login-card" style={{ gap: 14 }}>
      <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="text" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" required autoFocus defaultValue={res?.email || ''} key={res?.email || ''} style={{ height: 48 }} /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required style={{ height: 48 }} /></div>
      {res?.err && <p className="err" role="alert">{res.err}</p>}
      <button className="btn red" type="submit" disabled={pending || ok}>{pending || ok ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

export function PasswordForm() {
  const [res, action, pending] = useActionState<SignInState, FormData>(setPassword, null);
  const ok = !!res?.ok;
  useEffect(() => { if (ok) window.location.assign('/'); }, [ok]);
  return (
    <form action={action} className="login-card" style={{ gap: 14 }}>
      <div className="field"><label htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus style={{ height: 48 }} /></div>
      <div className="field"><label htmlFor="again">Same again</label><input className="input" id="again" name="again" type="password" autoComplete="new-password" required minLength={8} style={{ height: 48 }} /></div>
      {res?.err && <p className="err" role="alert">{res.err}</p>}
      <button className="btn red" type="submit" disabled={pending || ok}>{pending || ok ? 'Saving…' : 'Save and continue'}</button>
    </form>
  );
}
