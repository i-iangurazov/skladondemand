'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductReviewsSlider from './ProductReviewsSlider';
import StarRating from './StarRating';

type ReviewItem = {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  authorName?: string | null;
  authorEmail?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
};

type ReviewsResponse = {
  items: ReviewItem[];
  summary: { avg: number; count: number };
};

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type ProductReviewsSectionProps = {
  productHandle: string;
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

export default function ProductReviewsSection({ productHandle }: ProductReviewsSectionProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ rating: 5, title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [reviewsRes, userRes] = await Promise.all([
          fetch(`/api/reviews?productHandle=${encodeURIComponent(productHandle)}&limit=10`),
          fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' }),
        ]);
        const reviewsJson = reviewsRes.ok ? ((await reviewsRes.json()) as ReviewsResponse) : null;
        const userJson = userRes.ok ? (await userRes.json()) : null;
        setReviews(reviewsJson);
        setUser(userJson?.user ?? null);
      } catch {
        setReviews(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productHandle]);

  const summary = useMemo(() => {
    if (!reviews) return { avg: 0, count: 0 };
    return reviews.summary ?? { avg: 0, count: reviews.items.length };
  }, [reviews]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!user) {
      router.push(`/account/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productHandle,
          rating: form.rating,
          title: form.title?.trim() || undefined,
          body: form.body,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Failed to submit review.');
      }

      const fresh = await fetch(`/api/reviews?productHandle=${encodeURIComponent(productHandle)}&limit=10`);
      const json = fresh.ok ? ((await fresh.json()) as ReviewsResponse) : null;
      setReviews(json);
      setForm({ rating: 5, title: '', body: '' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border-t border-border pt-8">
        <div className="h-6 w-32 animate-pulse bg-muted" />
      </div>
    );
  }

  const items = reviews?.items ?? [];
  const formattedItems = items.map((item) => ({
    id: item.id,
    rating: item.rating,
    title: item.title ?? null,
    body: item.body,
    author: item.authorName ?? item.authorEmail ?? 'Anonymous',
    createdAt: item.createdAt,
    avatarUrl: item.avatarUrl ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-[0.32em] text-foreground">Reviews</h2>
        {summary.count > 0 ? (
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <div className="flex items-center gap-1 text-sm">{renderStars(summary.avg)}</div>
            <span>{summary.avg.toFixed(1)}</span>
            <span>({summary.count})</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
      </div>

      {items.length ? (
        <ProductReviewsSlider
          reviews={{ averageRating: summary.avg, ratingCount: summary.count, items: formattedItems }}
          showHeader={false}
        />
      ) : null}

      <div className="border-t border-border pt-6">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Write a review</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Rating
            <StarRating
              value={form.rating}
              onChange={(next) => setForm((prev) => ({ ...prev, rating: next }))}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Title (optional)
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
              maxLength={120}
            />
          </label>

          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Review
            <textarea
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              className="min-h-[120px] border border-border bg-white px-3 py-2 text-sm text-foreground rounded-none"
              maxLength={2000}
              required
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-10 border border-border bg-white px-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit review'}
          </button>
        </form>
      </div>
    </div>
  );
}
