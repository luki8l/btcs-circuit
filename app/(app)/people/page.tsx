import { rpcClient } from '@/lib/rpc';
import People, { type AdminPerson, type Act } from '@/components/People';
import { isPostgres } from '@/lib/backend';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const rpc = await rpcClient();
  let people: AdminPerson[] = [], feed: Act[] = [], denied = false;
  try { [people, feed] = await Promise.all([rpc<AdminPerson[]>('people_admin'), rpc<Act[]>('activity_feed', { p_limit: 80 })]); } catch { denied = true; }
  if (denied) return <main className="page"><h1 className="title">People</h1><p className="muted" style={{ marginTop: 12 }}>Only admins manage accounts.</p></main>;
  return <People people={people} feed={feed} microsoft={isPostgres()} secretKey={isPostgres() || !!process.env.SUPABASE_SECRET_KEY || process.env.CIRCUIT_LOCAL_DB === '1'} />;
}
