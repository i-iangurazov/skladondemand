import Link from 'next/link';
import CartClient from '@/components/store/CartClient';
import { Container } from '@/components/layout/Container';
import { getCart } from '@/lib/shopify/cart';
import { getCartIdFromCookies } from '@/lib/shopify/cart-cookie';
import { getStorefrontContext } from '@/lib/shopify/context';

export default async function CartPage() {
  const context = await getStorefrontContext();
  const cartId = await getCartIdFromCookies();
  const cart = cartId ? await getCart(cartId, context) : null;

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="bg-white text-foreground">
        <div className="py-12 sm:py-16">
          <Container>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
              <h1 className="text-2xl font-semibold">Your cart is empty</h1>
              <p className="text-sm text-muted-foreground">
                Browse collections and add your favorite pieces to start checkout.
              </p>
              <Link
                href="/collections"
                className="inline-flex h-10 items-center justify-center border border-border bg-primary px-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground sm:h-11"
              >
                Shop collections
              </Link>
            </div>
          </Container>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-foreground">
      <div className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col gap-8">
            <h1 className="text-2xl font-semibold">Cart</h1>
            <CartClient cart={cart} />
          </div>
        </Container>
      </div>
    </div>
  );
}
