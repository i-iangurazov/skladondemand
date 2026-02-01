import Link from 'next/link';
import { formatBrandLabel } from '@/lib/shopify/facets';

type BrandChipsProps = {
  brands: string[];
  className?: string;
};

export default function BrandChips({ brands, className }: BrandChipsProps) {
  if (!brands.length) return null;

  return (
    <section className={`flex flex-col gap-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs uppercase tracking-[0.32em] text-foreground">Shop by brand</h2>
        <Link
          href="/search"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          View all
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <div className="flex w-full gap-2 overflow-x-auto pb-1 sm:hidden">
          {brands.map((brand) => (
            <Link
              key={brand}
              href={`/search?brand=${encodeURIComponent(brand)}`}
              className="inline-flex shrink-0 items-center border border-black/15 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-black hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
            >
              {formatBrandLabel(brand)}
            </Link>
          ))}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {brands.map((brand) => (
            <Link
              key={brand}
              href={`/search?brand=${encodeURIComponent(brand)}`}
              className="inline-flex items-center border border-black/15 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-black hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
            >
              {formatBrandLabel(brand)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
