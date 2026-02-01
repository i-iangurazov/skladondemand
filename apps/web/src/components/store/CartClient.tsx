'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Cart } from '@/lib/shopify/cart';
import { formatMoney } from '@/lib/shopify/money';
import { removeCartLine, updateCartLine } from '@/app/actions/cart';
import ShopifyImage from './ShopifyImage';

export default function CartClient({ cart }: { cart: Cart }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const adjustQuantity = (lineId: string, nextQuantity: number) => {
    startTransition(async () => {
      if (nextQuantity <= 0) {
        await removeCartLine(lineId);
      } else {
        await updateCartLine(lineId, nextQuantity);
      }
      router.refresh();
    });
  };

  const handleRemove = (lineId: string) => {
    startTransition(async () => {
      await removeCartLine(lineId);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-8 pb-24 md:pb-0 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex flex-col gap-6">
        {cart.lines.map((line) => (
          <div key={line.id} className="flex flex-col gap-4 border border-border p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative aspect-[4/5] w-24 overflow-hidden bg-muted">
                <ShopifyImage
                  src={line.merchandise.product.featuredImage?.url}
                  alt={line.merchandise.product.featuredImage?.altText ?? line.merchandise.product.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{line.merchandise.product.title}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {line.merchandise.title}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {line.merchandise.selectedOptions.map((option) => (
                    <span key={option.name} className="mr-3">
                      {option.name}: {option.value}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Each: {formatMoney(line.cost.amountPerQuantity)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQuantity(line.id, line.quantity - 1)}
                  className="h-8 w-8 border border-border text-lg transition-colors hover:border-foreground hover:bg-hover disabled:cursor-not-allowed"
                  disabled={pending}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-[2ch] text-center text-sm">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => adjustQuantity(line.id, line.quantity + 1)}
                  className="h-8 w-8 border border-border text-lg transition-colors hover:border-foreground hover:bg-hover disabled:cursor-not-allowed"
                  disabled={pending}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <div className="text-sm font-semibold">{formatMoney(line.cost.totalAmount)}</div>
              <button
                type="button"
                onClick={() => handleRemove(line.id)}
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground md:self-center"
                disabled={pending}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-4 border border-border p-6 md:flex lg:sticky lg:top-24">
        <div className="flex items-center justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">{formatMoney(cart.cost.subtotalAmount)}</span>
        </div>
        {cart.cost.totalTaxAmount?.amount ? (
          <div className="flex items-center justify-between text-sm">
            <span>Tax</span>
            <span className="font-semibold">{formatMoney(cart.cost.totalTaxAmount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-4 text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(cart.cost.totalAmount)}</span>
        </div>
        <a
          href={cart.checkoutUrl}
          className="mt-4 inline-flex h-10 items-center justify-center border border-border bg-primary px-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-primary/90 sm:h-11"
        >
          Checkout
        </a>
        <p className="text-xs text-muted-foreground">
          Checkout is handled by Shopify so Airwallex, Klarna, and Clearpay apply automatically.
        </p>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-white p-4 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-between text-sm">
          <span>Total</span>
          <span className="font-semibold">{formatMoney(cart.cost.totalAmount)}</span>
        </div>
        <a
          href={cart.checkoutUrl}
          className="mt-3 inline-flex h-10 w-full items-center justify-center border border-border bg-primary px-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Checkout
        </a>
      </div>
    </div>
  );
}
