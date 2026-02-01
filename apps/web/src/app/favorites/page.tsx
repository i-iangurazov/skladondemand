import { redirect } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { requireUser } from '@/lib/auth/requireUser';
import { getStorefrontContext } from '@/lib/shopify/context';
import FavoritesClient from '@/components/store/FavoritesClient';

export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/account/login?next=/favorites');
  }

  const context = await getStorefrontContext();

  return (
    <div className="bg-white text-foreground">
      <div className="py-10">
        <Container>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Favorites</h1>
              <p className="text-sm text-muted-foreground">Saved items from your wishlist.</p>
            </div>
            <FavoritesClient country={context.country} />
          </div>
        </Container>
      </div>
    </div>
  );
}
