'use client';

import Link from 'next/link';
import type { ProductSummary } from '@/lib/shopify/schemas';
import { formatMoney } from '@/lib/shopify/money';
import ShopifyImage from './ShopifyImage';
import FavoriteButton from './FavoriteButton';

const DEFAULT_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';

export default function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const min = formatMoney(product.priceRange.min);
  const max = formatMoney(product.priceRange.max);
  const priceLabel = min === max ? min : `${min} — ${max}`;

  return (
    <div className="group relative flex flex-col gap-3 border border-border bg-white p-3 transition hover:border-foreground">
      <div className="absolute right-3 top-3 z-10">
        <FavoriteButton productHandle={product.handle} />
      </div>
      <Link href={`/products/${product.handle}`} className="flex flex-col gap-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          <ShopifyImage
            src={product.featuredImage?.url}
            alt={product.featuredImage?.altText ?? product.title}
            fill
            sizes={DEFAULT_SIZES}
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            priority={priority}
            loading="lazy"
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">{product.title}</h3>
          <p className="text-sm text-muted-foreground">{priceLabel}</p>
          {!product.availableForSale && (
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sold out</span>
          )}
        </div>
      </Link>
    </div>
  );
}
