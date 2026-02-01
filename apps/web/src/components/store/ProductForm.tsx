'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductDetail, ProductVariant } from '@/lib/shopify/schemas';
import { formatMoney } from '@/lib/shopify/money';
import { addToCart } from '@/app/actions/cart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const buildInitialSelection = (product: ProductDetail) => {
  const fallback = product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
  const selection: Record<string, string> = {};
  (fallback?.selectedOptions ?? []).forEach((option) => {
    selection[option.name] = option.value;
  });
  product.options.forEach((option) => {
    if (!selection[option.name]) {
      selection[option.name] = option.values[0] ?? '';
    }
  });
  return selection;
};

const matchVariant = (variants: ProductVariant[], selection: Record<string, string>) => {
  return (
    variants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value)
    ) ?? variants[0]
  );
};

export default function ProductForm({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Record<string, string>>(() => buildInitialSelection(product));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const visibleOptions = product.options.filter(
    (option) => !(option.name === 'Title' && option.values.length === 1)
  );

  const selectedVariant = useMemo(
    () => matchVariant(product.variants, selection),
    [product.variants, selection]
  );

  const priceLabel = formatMoney(selectedVariant.price);
  const compareAt = selectedVariant.compareAtPrice ? formatMoney(selectedVariant.compareAtPrice) : null;

  const onAdd = () => {
    setStatus(null);
    startTransition(async () => {
      await addToCart(selectedVariant.id, 1);
      setStatus('Added to cart');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-xl font-semibold">{priceLabel}</p>
          {compareAt && compareAt !== priceLabel && (
            <p className="text-sm text-muted-foreground line-through">{compareAt}</p>
          )}
        </div>
        {!selectedVariant.availableForSale && (
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Unavailable</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {visibleOptions.map((option) => (
          <label key={option.name} className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{option.name}</span>
            <Select
              value={selection[option.name] ?? ''}
              onValueChange={(value) => setSelection((prev) => ({ ...prev, [option.name]: value }))}
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {option.values.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={pending || !selectedVariant.availableForSale}
          className="h-10 cursor-pointer border border-border bg-primary px-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11"
        >
          Add to cart
        </button>
        {status && <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{status}</p>}
      </div>
    </div>
  );
}
