import Account from '@/components/Account';
import { isPostgres } from '@/lib/backend';

export default function Page() { return <Account microsoft={isPostgres()} />; }
