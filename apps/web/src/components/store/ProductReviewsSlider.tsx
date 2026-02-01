'use client';

import { useRef } from 'react';
import ShopifyImage from './ShopifyImage';
import type { ProductReviewsResult } from '@/lib/shopify/review-model';

type ProductReviewsSliderProps = {
  reviews: ProductReviewsResult | null;
  title?: string;
  showHeader?: boolean;
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/);
  if (!parts.length) return 'A';
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  const initials = `${first}${second}`.toUpperCase();
  return initials || 'A';
};

const renderStars = (rating: number) =>
  Array.from({ length: 5 }).map((_, index) => {
    const filled = index < Math.round(rating);
    return (
      <span key={index} className={filled ? 'text-black' : 'text-neutral-300'}>
        ★
      </span>
    );
  });

export default function ProductReviewsSlider({ reviews, title = 'Reviews', showHeader = true }: ProductReviewsSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const items = reviews?.items ?? [];

  const scrollByWidth = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const distance = Math.round(track.clientWidth * 0.9);
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-6">
      {showHeader ? (
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs uppercase tracking-[0.32em] text-foreground">{title}</h2>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByWidth(-1)}
              className="inline-flex h-9 items-center justify-center border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              aria-label="Scroll reviews backward"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => scrollByWidth(1)}
              className="inline-flex h-9 items-center justify-center border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              aria-label="Scroll reviews forward"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="border border-border bg-white p-4 text-sm text-muted-foreground">
          <p className="text-sm text-foreground">No reviews yet.</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Be the first to review this item.
          </p>
        </div>
      ) : (
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
          aria-label="Product reviews"
        >
          {items.map((review) => (
          <article
            key={review.id}
            className="flex min-w-[280px] flex-col gap-4 border border-black/10 bg-white p-4 text-sm snap-start md:min-w-[340px]"
          >
              <div className="flex items-center gap-3">
                <div className="relative flex size-10 items-center justify-center border border-border bg-hover text-xs uppercase tracking-[0.2em] text-foreground">
                  {review.avatarUrl ? (
                    <ShopifyImage
                      src={review.avatarUrl}
                      alt={review.author ?? 'Reviewer'}
                      fill
                      sizes="40px"
                      className="object-cover"
                      fallbackText={getInitials(review.author ?? 'A')}
                    />
                  ) : (
                    <span>{getInitials(review.author ?? 'A')}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-foreground">
                    {review.author ?? 'Anonymous'}
                  </span>
                  <div className="flex items-center gap-1 text-xs">{renderStars(review.rating)}</div>
                </div>
              </div>
              {review.title ? <h3 className="text-sm font-semibold">{review.title}</h3> : null}
              <p className="text-sm text-foreground line-clamp-5">{review.body}</p>
              {review.createdAt ? (
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('en-GB')}
                </span>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
