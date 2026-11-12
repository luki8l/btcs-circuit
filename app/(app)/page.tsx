import { redirect } from 'next/navigation';
import { rpcClient } from '@/lib/rpc';

export const dynamic = 'force-dynamic';
export default async function Home() {
  let role = 'sales';
  try { role = (await (await rpcClient())<{ role: string }>('me')).role; } catch { redirect('/login'); }
  redirect(role === 'management' ? '/insights' : role === 'sales' ? '/discover' : '/approvals');
}
