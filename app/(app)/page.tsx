import { redirect } from 'next/navigation';
import { rpcClient } from '@/lib/rpc';
import type { Data } from '@/lib/model';

export const dynamic = 'force-dynamic';
// start page: sales find events; Roman lands on Requests when something waits for him, otherwise on the Overview
export default async function Home() {
  let data: Pick<Data, 'me' | 'requests'> | null = null;
  try { data = await (await rpcClient())<Data>('bootstrap'); } catch { redirect('/login'); }
  const role = data!.me.role, waiting = data!.requests.some(r => r.status === 'requested');
  redirect(role === 'sales' ? '/discover' : role === 'management' ? '/insights' : waiting ? '/approvals' : '/insights');
}
