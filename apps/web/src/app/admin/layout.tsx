import { redirect } from 'next/navigation';
import { UserRole } from '@qr/db';
import { getSessionUser } from '@/lib/auth/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-white text-foreground">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-10">
          <h1 className="text-2xl font-semibold">Forbidden</h1>
          <p className="text-sm text-muted-foreground">You do not have access to this area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
