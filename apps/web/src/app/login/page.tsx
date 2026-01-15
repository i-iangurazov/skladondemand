import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { getSessionUser } from '@/lib/auth/session';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="relative min-h-screen bg-white text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,40,0,0.12),transparent_55%),radial-gradient(circle_at_right,_rgba(67,37,135,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#0000000f_1px,transparent_1px)] [background-size:18px_18px]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <LoginForm />
      </main>
    </div>
  );
}
