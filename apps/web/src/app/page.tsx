import AvantechApp from '@/components/avantech/AvantechApp';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  return <AvantechApp />;
}
