import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import RegisterForm from '@/components/account/RegisterForm';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <div className="bg-white text-foreground">
      <div className="py-10">
        <Container>
          <div className="mx-auto flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Create account</h1>
              <p className="text-sm text-muted-foreground">
                Register to save favorites, manage delivery addresses, and collect bonus points.
              </p>
            </div>
            <RegisterForm />
            <Link
              href="/account/login"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Back to sign in
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}
