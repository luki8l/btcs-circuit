// Every signed-in page: loads everything once (bootstrap), refreshed after each change (router.refresh()).
import { redirect } from 'next/navigation';
import { rpcClient, statusOf, DbError } from '@/lib/rpc';
import type { Data } from '@/lib/model';
import AppProvider from '@/components/AppProvider';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

function Notice({ title, text }: { title: string; text: string }) {
  return <main className="page"><p className="k">Circuit</p><h1 className="title" style={{ marginTop: 8 }}>{title}</h1><p className="muted" style={{ marginTop: 14, maxWidth: '60ch' }}>{text}</p>
    <form action="/auth/signout" method="post" style={{ marginTop: 24 }}><button className="btn">Sign out</button></form></main>;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let data: Data | null = null, status = 0, missing = false;
  try { data = await (await rpcClient())<Data>('bootstrap'); }
  catch (e) {
    status = statusOf(e);
    missing = e instanceof DbError && ['PGRST202', '42883', 'PGRST205', '42P01'].includes(e.code);
    if (!missing && status === 500) throw e;
  }
  if (status === 401) redirect('/login');
  if (missing) return <Notice title="Not set up yet" text="The database has no Circuit tables yet. Run the files in supabase/migrations (see the README)." />;
  if (status === 403 || !data) return <Notice title="No access" text="Your account is deactivated. Ask an admin (People) to switch it back on." />;
  return <AppProvider data={data}><Shell>{children}</Shell></AppProvider>;
}
