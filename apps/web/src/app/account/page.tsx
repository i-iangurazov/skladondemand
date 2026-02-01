import { Container } from '@/components/layout/Container';
import AccountDashboard from '@/components/account/AccountDashboard';
import { AccountProvider } from '@/components/account/AccountProvider';

export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <div className="bg-white text-foreground">
      <div className="py-10">
        <Container>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Account</h1>
              <p className="text-sm text-muted-foreground">Manage your profile, addresses, and bonuses.</p>
            </div>
            <AccountProvider>
              <AccountDashboard />
            </AccountProvider>
          </div>
        </Container>
      </div>
    </div>
  );
}
