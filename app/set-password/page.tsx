import { redirect } from 'next/navigation';
import { PasswordForm } from '../login/form';
import { fromFreshLink } from '@/lib/supabase';
import { LOCAL } from '@/lib/rpc';

// only reachable right after a sign-in link; signed in the normal way, the password is changed under Account
export default async function SetPassword() {
  if (!LOCAL && !(await fromFreshLink())) redirect('/account');
  return (
    <main className="login">
      <section className="login-l">
        <img src="/logo-dark.png" alt="Bitcoin Suisse" />
        <h1 className="title">Welcome to <em>Circuit</em>.</h1>
        <p>Choose a password. Next time you sign in with your e-mail and this password.</p>
      </section>
      <section className="login-r"><div className="login-card"><p className="k">Your account</p><h2 className="h2">Set a password</h2><PasswordForm /></div></section>
    </main>
  );
}
