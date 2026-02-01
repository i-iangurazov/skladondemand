'use client';

import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatMoney } from '@/lib/shopify/money';
import ShopifyImage from './ShopifyImage';

type SuggestionResponse = {
  products: Array<{
    id: string;
    handle: string;
    title: string;
    featuredImage?: { url: string; altText?: string | null } | null;
    priceRange: {
      min: { amount: string; currencyCode: string };
      max: { amount: string; currencyCode: string };
    };
  }>;
  collections: Array<{
    id: string;
    handle: string;
    title: string;
  }>;
};

type SuggestionItem =
  | { type: 'product'; id: string; href: string; label: string; image?: string | null; price?: string }
  | { type: 'collection'; id: string; href: string; label: string };

type SearchBoxProps = {
  country: string;
  className?: string;
};

const DEBOUNCE_MS = 180;

export default function SearchBox({ country, className }: SearchBoxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SuggestionResponse>({ products: [], collections: [] });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Map<string, SuggestionResponse>>(new Map());

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const flattened: SuggestionItem[] = [
    ...suggestions.products.map((product): SuggestionItem => {
      const min = formatMoney(product.priceRange.min);
      const max = formatMoney(product.priceRange.max);
      const priceLabel = min === max ? min : `${min} — ${max}`;
      return {
        type: 'product',
        id: product.id,
        href: `/products/${product.handle}`,
        label: product.title,
        image: product.featuredImage?.url ?? null,
        price: priceLabel,
      };
    }),
    ...suggestions.collections.map(
      (collection): SuggestionItem => ({
        type: 'collection',
        id: collection.id,
        href: `/collections/${collection.handle}`,
        label: collection.title,
      })
    ),
  ];

  const closeSuggestions = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const fetchSuggestions = async (value: string) => {
    const cached = cacheRef.current.get(value);
    if (cached) {
      setSuggestions(cached);
      setOpen(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `/api/storefront/suggestions?q=${encodeURIComponent(value)}&country=${encodeURIComponent(country)}`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error('Failed to load suggestions');
      }
      const data = (await response.json()) as SuggestionResponse;
      cacheRef.current.set(value, data);
      setSuggestions(data);
      setOpen(true);
    } catch {
      if (!controller.signal.aborted) {
        setSuggestions({ products: [], collections: [] });
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions({ products: [], collections: [] });
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query.trim());
    }, DEBOUNCE_MS);
  }, [query, country]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeSuggestions();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = () => {
    const value = query.trim();
    if (!value) return;
    closeSuggestions();
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!flattened.length) {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flattened.length);
      setOpen(true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flattened.length) % flattened.length);
      setOpen(true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = flattened[activeIndex];
      if (active) {
        closeSuggestions();
        router.push(active.href);
      } else {
        handleSubmit();
      }
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ''}`}>
      <div className="flex h-10 w-full items-center border border-border bg-white px-3">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search"
          className="w-full bg-transparent text-[12px] uppercase tracking-[0.2em] text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search"
        />
      </div>

      {open && flattened.length ? (
        <div
          className="fixed inset-x-0 z-30 mt-2 px-4 sm:px-6"
          style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
          role="listbox"
        >
          <div className="mx-auto w-full max-w-none border border-border bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:max-w-[820px]">
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
              {flattened.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className={`flex items-center gap-3 border border-transparent p-2 text-sm transition ${
                      isActive ? 'border-border bg-hover' : 'hover:bg-hover'
                    }`}
                    onClick={() => closeSuggestions()}
                  >
                    {item.type === 'product' ? (
                      <div className="relative aspect-[3/4] w-10 border border-border bg-muted">
                        <ShopifyImage
                          src={item.image ?? undefined}
                          alt={item.label}
                          fill
                          sizes="40px"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center border border-border text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        C
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      {item.type === 'product' ? (
                        <span className="text-xs text-muted-foreground">{item.price}</span>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Collection</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
