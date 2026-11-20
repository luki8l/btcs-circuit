import { redirect } from 'next/navigation';
import { LoginForm } from './form';
import Art from './Art';
import { isPostgres } from '@/lib/backend';

// postgres mode: sign-in with Microsoft only. Without a reason to stop (an error, or you just signed out) the page
// goes straight on to Microsoft, which usually signs you in without a click.
const MS_ERR: Record<string, string> = {
  no_account: 'There is no Circuit account for {email} yet. Ask an admin to add you (People).',
  inactive: 'Your Circuit account is switched off. Ask an admin to switch it back on.',
  org: 'Please sign in with your Bitcoin Suisse Microsoft account.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'The sign-in took too long. Please try again.',
  config: 'Microsoft sign-in is not set up yet (see docs/HANDOVER.md).',
  failed: 'Sign-in did not work. Please try again.',
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; link?: string; error?: string; email?: string; signedout?: string; expired?: string }> }) {
  const sp = await searchParams;
  const next = /^\/(?![/\\])[^\\]*$/.test(sp.next || '') ? sp.next! : '/';
  const ms = isPostgres();
  if (ms && !sp.error && !sp.signedout) redirect(`/auth/microsoft${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`);
  return (
    <main className="login">
      <section className="login-l">
        <img src="/logo-dark.png" alt="Bitcoin Suisse" />
        <h1 className="title">External events, <em>one circuit</em>.</h1>
        <Art />
        <p>Find the conference, request your spot, get it approved, log it in HubSpot. For the sales and events teams of Bitcoin Suisse.</p>
      </section>
      <section className="login-r">
        <div className="login-card">
          <p className="k">Circuit</p>
          <h2 className="h2">Sign in</h2>
          {ms ? <>
            {sp.error && <p className="err" role="alert">{(MS_ERR[sp.error] || MS_ERR.failed).replace('{email}', sp.email || 'this Microsoft account')}</p>}
            {sp.signedout && <p className="muted">You are signed out.</p>}
            <a className="btn red lg" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} href={`/auth/microsoft${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in with Microsoft</a>
            <p className="foot2">Use your Bitcoin Suisse account. Circuit accounts are set up by an admin.</p>
          </> : <>
            {sp.link && <p className="err">That sign-in link has expired or was used already. Ask an admin for a new one.</p>}
            <LoginForm next={next} />
            <p className="foot2">Accounts are set up by an admin. Forgot your password? Ask for a new sign-in link.</p>
          </>}
        </div>
      </section>
    </main>
  );
}
