'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductSummary } from '@/lib/shopify/schemas';
import ProductCard from './ProductCard';

type PageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

type InitialPage = {
  products: ProductSummary[];
  pageInfo: PageInfo;
  mode?: 'featured' | 'latest';
};

type InfiniteProductGridProps = {
  initial: InitialPage;
  endpoint: string;
  pageSize?: number;
  priorityCount?: number;
};

const buildUrl = (endpoint: string, params: Record<string, string | undefined | null>) => {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const mergeUniqueById = (prev: ProductSummary[], next: ProductSummary[]) => {
  if (!next.length) return prev;
  const seen = new Set(prev.map((item) => item.id));
  const merged = [...prev];
  next.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
};

export default function InfiniteProductGrid({
  initial,
  endpoint,
  pageSize = 24,
  priorityCount = 0,
}: InfiniteProductGridProps) {
  const [items, setItems] = useState<ProductSummary[]>(initial.products);
  const [pageInfo, setPageInfo] = useState<PageInfo>(initial.pageInfo);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const canLoadMore = pageInfo.hasNextPage && !pendingRef.current;

  const loadMore = async () => {
    if (!pageInfo.hasNextPage || pendingRef.current) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 300) return;
    lastFetchRef.current = now;
    pendingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const url = buildUrl(endpoint, {
        after: pageInfo.endCursor ?? undefined,
        pageSize: pageSize.toString(),
        mode: initial.mode,
      });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status}`);
      }
      const data = (await response.json()) as InitialPage;
      if (!data?.pageInfo) {
        throw new Error('Invalid response from products endpoint.');
      }

      setItems((prev) => mergeUniqueById(prev, data.products ?? []));
      setPageInfo(data.pageInfo);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load more products.');
    } finally {
      pendingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !pageInfo.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [pageInfo.hasNextPage, endpoint]);

  const placeholders = useMemo(() => Array.from({ length: 6 }), []);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < priorityCount} />
        ))}
        {isLoading &&
          placeholders.map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="flex aspect-[3/4] w-full animate-pulse border border-border bg-muted"
            />
          ))}
      </div>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      {pageInfo.hasNextPage ? (
        <div ref={sentinelRef} className="h-10 w-full" aria-hidden={!canLoadMore} />
      ) : (
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">End of list</p>
      )}
    </div>
  );
}
