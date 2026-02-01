'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ShopifyImage from './ShopifyImage';

type ReviewItem = {
  id: string;
  productHandle: string;
  rating: number;
  body: string;
  authorName?: string | null;
  avatarUrl?: string | null;
};

type ReviewsResponse = {
  items: ReviewItem[];
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

export default function HomeReviewsSection() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/reviews/recent?limit=10');
        if (!response.ok) throw new Error('Failed to load reviews');
        const data = (await response.json()) as ReviewsResponse;
        setItems(data.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  if (!loaded || items.length === 0) return null;

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('[data-card]');
    const gap = 16;
    const width = card?.getBoundingClientRect().width ?? 320;
    track.scrollBy({ left: direction * (width + gap), behavior: 'smooth' });
  };

  return (
    <section className="mt-10 border-t border-border pt-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs uppercase tracking-[0.32em] text-foreground">Reviews</h2>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              className="inline-flex h-9 items-center justify-center border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              aria-label="Scroll reviews backward"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              className="inline-flex h-9 items-center justify-center border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              aria-label="Scroll reviews forward"
            >
              Next
            </button>
          </div>
        </div>
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
          aria-label="Latest reviews"
        >
          {items.map((review) => (
            <article
              key={review.id}
              data-card
              className="flex min-w-[280px] flex-col gap-4 border border-black/10 bg-white p-4 text-sm snap-start md:min-w-[340px]"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex size-10 items-center justify-center border border-border bg-hover text-xs uppercase tracking-[0.2em] text-foreground">
                  {review.avatarUrl ? (
                    <ShopifyImage
                      src={review.avatarUrl}
                      alt={review.authorName ?? 'Reviewer'}
                      fill
                      sizes="40px"
                      className="object-cover"
                      fallbackText={getInitials(review.authorName ?? 'A')}
                    />
                  ) : (
                    <span>{getInitials(review.authorName ?? 'A')}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-foreground">
                    {review.authorName ?? 'Anonymous'}
                  </span>
                  <div className="flex items-center gap-1 text-xs">{renderStars(review.rating)}</div>
                </div>
              </div>
              <p className="text-sm text-foreground line-clamp-4">{review.body}</p>
              <Link
                href={`/products/${review.productHandle}`}
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                View product
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
