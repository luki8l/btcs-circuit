import { LoginForm } from './form';
import Art from './Art';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; link?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <section className="login-l">
        <img src="/logo.png" alt="Bitcoin Suisse" />
        <h1 className="title">External events, <em>one circuit</em>.</h1>
        <Art />
        <p>Find the conference, request your spot, get it approved, log it in HubSpot. For the sales and events teams of Bitcoin Suisse.</p>
      </section>
      <section className="login-r">
        <div className="login-card">
          <p className="k">Circuit</p>
          <h2 className="h2">Sign in</h2>
          {sp.link && <p className="err">That sign-in link has expired or was used already. Ask an admin for a new one.</p>}
          <LoginForm next={sp.next || '/'} />
          <p className="foot2">Accounts are set up by an admin. Forgot your password? Ask for a new sign-in link.</p>
        </div>
      </section>
    </main>
  );
}
