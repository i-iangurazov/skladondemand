import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import LoginForm from '@/components/account/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="bg-white text-foreground">
      <div className="py-10">
        <Container>
          <div className="mx-auto flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="text-sm text-muted-foreground">
                Access your account, favorites, and bonus balance.
              </p>
            </div>
            <LoginForm />
            <Link
              href="/account/register"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Create account
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}
