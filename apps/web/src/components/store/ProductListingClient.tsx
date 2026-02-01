'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ProductSummary } from '@/lib/shopify/schemas';
import { type Facets } from '@/lib/shopify/facets';
import { DEFAULT_PAGE_SIZE } from '@/lib/shopify/constants';
import { getTotalPages, isUpperBrandTag } from '@/lib/shopify/pagination';
import { parseSortParams, type SortDirection, type SortKeyParam } from '@/lib/shopify/sort';
import ProductCard from './ProductCard';
import FiltersBar from './FiltersBar';
import SortSelect from './SortSelect';
import Pagination from './Pagination';

type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
};

type ListingMode = 'collection' | 'search' | 'all';

type CursorEntry = {
  after: string | null;
  startCursor?: string | null;
  endCursor?: string | null;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

type CursorMap = Record<number, CursorEntry>;

type ProductListingClientProps = {
  mode: ListingMode;
  country: string;
  handle?: string;
  query?: string | null;
  initialItems: ProductSummary[];
  initialPageInfo: PageInfo;
  initialFacets: Facets;
  initialTotalCount?: number | null;
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const MAX_CURSOR_STEPS = 3;

const buildUrl = (params: Record<string, string | null | undefined>) => {
  const url = new URL('/api/storefront/products', window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const normalizePage = (value: string | null) => {
  const parsed = Number.parseInt(value ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
};

const seedCursorMap = (pageInfo: PageInfo): CursorMap => ({
  1: {
    after: null,
    startCursor: pageInfo.startCursor ?? null,
    endCursor: pageInfo.endCursor ?? null,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage ?? false,
  },
});

const readCursorMap = (storageKey: string): CursorMap | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CursorMap;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCursorMap = (storageKey: string, map: CursorMap) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(map));
};

const getMaxKnownPage = (map: CursorMap) => {
  const keys = Object.keys(map).map((key) => Number.parseInt(key, 10)).filter(Number.isFinite);
  return keys.length ? Math.max(...keys, 1) : 1;
};

const mergeFacetSets = (base: Facets, override?: Facets | null): Facets => {
  if (!override) return base;
  return {
    brands: override.brands,
    colors: override.colors,
    brandMode: override.brandMode,
    colorMode: override.colorMode,
  };
};

const getAfterForPage = (page: number, map: CursorMap) => {
  if (page <= 1) return null;
  if (map[page]?.after !== undefined) return map[page]?.after ?? null;
  return map[page - 1]?.endCursor ?? null;
};

export default function ProductListingClient({
  mode,
  handle,
  country,
  query,
  initialItems,
  initialPageInfo,
  initialFacets,
  initialTotalCount = null,
}: ProductListingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);

  const [items, setItems] = useState<ProductSummary[]>(initialItems);
  const [pageInfo, setPageInfo] = useState<PageInfo>(initialPageInfo);
  const [facets, setFacets] = useState<Facets>(initialFacets);
  const [facetOverride, setFacetOverride] = useState<Facets | null>(null);
  const [cursorMap, setCursorMap] = useState<CursorMap>(() => seedCursorMap(initialPageInfo));
  const [totalCount, setTotalCount] = useState<number | null>(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastLoadedPageRef = useRef(1);

  const pageParam = normalizePage(searchParams.get('page'));
  const currentPage = pageParam;
  const activePage = pendingPage ?? currentPage;
  const { sort, dir } = parseSortParams(searchParams.get('sort'), searchParams.get('dir'));

  const availParam = searchParams.get('avail');
  const avail: '' | 'in' | 'out' = availParam === 'in' || availParam === 'out' ? availParam : '';
  const filters: { brand: string; avail: '' | 'in' | 'out'; color: string } = {
    brand: searchParams.get('brand') ?? '',
    avail,
    color: searchParams.get('color') ?? '',
  };

  const baseKey = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const queryString = params.toString();
    return `${pathname}?${queryString}`;
  }, [pathname, searchParams]);

  const storageKey = useMemo(() => `cursorMap:${baseKey}`, [baseKey]);
  const facetKey = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    params.delete('brand');
    params.delete('color');
    const queryString = params.toString();
    return `v2:${pathname}?${queryString}`;
  }, [pathname, searchParams]);

  const effectiveFacets = useMemo(() => mergeFacetSets(facets, facetOverride), [facets, facetOverride]);

  const displayItems = items;

  const updateSearchParams = (next: Partial<typeof filters> & { sort?: SortKeyParam; dir?: SortDirection }) => {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value?: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    const nextSort = next.sort ?? sort;
    const nextDir = next.dir ?? dir;

    setOrDelete('brand', next.brand ?? filters.brand);
    setOrDelete('avail', next.avail ?? filters.avail);
    setOrDelete('color', next.color ?? filters.color);
    setOrDelete('sort', nextSort);
    params.delete('page');
    if (nextSort === 'featured' || nextSort === 'bestSelling') {
      params.delete('dir');
    } else {
      setOrDelete('dir', nextDir);
    }

    const queryString = params.toString();
    setPendingPage(null);
    startTransition(() => {
      router.push(queryString ? `?${queryString}` : pathname, { scroll: false });
    });
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('brand');
    params.delete('avail');
    params.delete('color');
    params.delete('page');
    const queryString = params.toString();
    setPendingPage(null);
    startTransition(() => {
      router.push(queryString ? `?${queryString}` : pathname, { scroll: false });
    });
  };

  const setPageParam = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage <= 1) {
        params.delete('page');
      } else {
        params.set('page', nextPage.toString());
      }
      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || Number.isNaN(nextPage)) return;
      setPendingPage(nextPage);
      startTransition(() => {
        setPageParam(nextPage);
      });
    },
    [setPageParam, startTransition]
  );

  const fetchPage = useCallback(
    async (cursor?: string | null, direction: 'next' | 'prev' = 'next') => {
      const params: Record<string, string | null | undefined> = {
        mode,
        handle,
        q: query ?? searchParams.get('q') ?? undefined,
        cursor: cursor ?? undefined,
        direction,
        sort,
        dir,
        brand: filters.brand || undefined,
        avail: filters.avail || undefined,
        color: mode === 'collection' ? filters.color || undefined : undefined,
        pageSize: PAGE_SIZE.toString(),
        country,
      };

      const response = await fetch(buildUrl(params));
      if (!response.ok) {
        throw new Error('Failed to load products.');
      }

      const data = (await response.json()) as {
        items: ProductSummary[];
        pageInfo: PageInfo;
        totalCount: number | null;
      };
      return data;
    },
    [country, dir, filters.avail, filters.color, filters.brand, handle, mode, query, searchParams, sort]
  );

  useEffect(() => {
    const stored = readCursorMap(storageKey);
    const seeded = seedCursorMap(initialPageInfo);
    if (stored) {
      const merged = {
        ...stored,
        1: {
          ...seeded[1],
          ...(stored[1] ?? {}),
          after: null,
        },
      } as CursorMap;
      setCursorMap(merged);
    } else {
      setCursorMap(seeded);
    }
    setItems(initialItems);
    setPageInfo(initialPageInfo);
    setFacets(initialFacets);
    setFacetOverride(null);
    lastLoadedPageRef.current = 1;
    setPendingPage(null);
    setTotalCount(initialTotalCount);
    setError(null);
  }, [storageKey, initialItems, initialPageInfo, initialFacets, initialTotalCount]);

  useEffect(() => {
    writeCursorMap(storageKey, cursorMap);
  }, [storageKey, cursorMap]);

  useEffect(() => {
    const cached = typeof window !== 'undefined' ? window.sessionStorage.getItem(`facets:${facetKey}`) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Facets;
        setFacetOverride(parsed);
        return;
      } catch {
        // fall through
      }
    }

    const params = new URLSearchParams();
    params.set('mode', mode);
    if (handle) params.set('handle', handle);
    const qParam = query ?? searchParams.get('q');
    if (qParam) params.set('q', qParam);
    params.set('country', country);

    const toFacets = (data: unknown): Facets | null => {
      if (!data || typeof data !== 'object') return null;
      const payload = data as {
        brands?: string[];
        colors?: string[];
      };
      const brands = payload.brands ?? [];
      const colors = payload.colors ?? [];
      const brandMode = 'tag';
      const colorMode: Facets['colorMode'] =
        colors.length === 0 ? 'none' : mode === 'collection' ? 'metafield' : 'none';
      return {
        brands,
        colors,
        brandMode,
        colorMode,
      };
    };

    fetch(`/api/storefront/facets?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const mapped = toFacets(data);
        if (!mapped) return;
        setFacetOverride(mapped);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(`facets:${facetKey}`, JSON.stringify(mapped));
        }
      })
      .catch(() => null);
  }, [facetKey, mode, handle, country, query, searchParams]);

  const updateCursorEntry = useCallback(
    (map: CursorMap, page: number, after: string | null, info: PageInfo) => ({
      ...map,
      [page]: {
        after,
        startCursor: info.startCursor ?? null,
        endCursor: info.endCursor ?? null,
        hasNextPage: info.hasNextPage,
        hasPreviousPage: info.hasPreviousPage ?? false,
      },
    }),
    []
  );

  const resolvePageData = useCallback(
    async (targetPage: number) => {
      let workingMap = { ...cursorMap };
      const existing = workingMap[targetPage];
      if (existing && targetPage !== 1) {
        const data = await fetchPage(existing.after ?? null);
        workingMap = updateCursorEntry(workingMap, targetPage, existing.after ?? null, data.pageInfo);
        return { page: targetPage, data, map: workingMap, fallback: false };
      }

      let maxKnownPage = getMaxKnownPage(workingMap);
      if (targetPage <= maxKnownPage && targetPage !== 1) {
        const entry = workingMap[targetPage];
        if (entry?.after !== undefined) {
          const data = await fetchPage(entry.after ?? null);
          workingMap = updateCursorEntry(workingMap, targetPage, entry.after ?? null, data.pageInfo);
          return { page: targetPage, data, map: workingMap, fallback: false };
        }
      }

      let current = maxKnownPage;
      let after = workingMap[current]?.endCursor ?? null;
      let lastData:
        | {
            items: ProductSummary[];
            pageInfo: PageInfo;
            totalCount: number | null;
          }
        | null = null;
      let steps = 0;

      while (current < targetPage && steps < MAX_CURSOR_STEPS && after) {
        const data = await fetchPage(after);
        const nextPage = current + 1;
        workingMap = updateCursorEntry(workingMap, nextPage, after, data.pageInfo);
        current = nextPage;
        lastData = data;
        after = data.pageInfo.endCursor ?? null;
        steps += 1;
        if (!data.pageInfo.hasNextPage) {
          break;
        }
      }

      if (current === targetPage && lastData) {
        return { page: current, data: lastData, map: workingMap, fallback: false };
      }

      if (lastData) {
        return { page: current, data: lastData, map: workingMap, fallback: true };
      }

      return null;
    },
    [cursorMap, fetchPage, updateCursorEntry]
  );

  const scrollToGrid = () => {
    if (!gridRef.current) return;
    gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const loadPage = useCallback(
    async (targetPage: number) => {
      const previousPage = lastLoadedPageRef.current;
      if (targetPage === previousPage) return;
      setIsLoading(true);
      setError(null);
      const requestId = ++requestRef.current;

      try {
        if (targetPage <= 1) {
          setItems(initialItems);
          setPageInfo(initialPageInfo);
          setTotalCount(initialTotalCount);
          lastLoadedPageRef.current = 1;
          scrollToGrid();
          return;
        }

        if (targetPage === previousPage - 1 && pageInfo.startCursor) {
          const previousAfter = getAfterForPage(targetPage, cursorMap);
          const data = await fetchPage(pageInfo.startCursor, 'prev');
          if (requestRef.current !== requestId) return;
          const updatedMap = updateCursorEntry(cursorMap, targetPage, previousAfter, data.pageInfo);
          setCursorMap(updatedMap);
          setItems(data.items ?? []);
          setPageInfo(data.pageInfo);
          setTotalCount(data.totalCount);
          lastLoadedPageRef.current = targetPage;
          scrollToGrid();
          return;
        }

        const resolved = await resolvePageData(targetPage);
        if (!resolved) {
          setItems(initialItems);
          setPageInfo(initialPageInfo);
          setTotalCount(initialTotalCount);
          lastLoadedPageRef.current = 1;
          setPageParam(1);
          scrollToGrid();
          return;
        }

        if (requestRef.current !== requestId) return;

        setCursorMap(resolved.map);
        setItems(resolved.data.items ?? []);
        setPageInfo(resolved.data.pageInfo);
        setTotalCount(resolved.data.totalCount);
        lastLoadedPageRef.current = resolved.page;

        if (resolved.fallback && resolved.page !== targetPage) {
          setPageParam(resolved.page);
        }

        scrollToGrid();
      } catch (fetchError) {
        if (requestRef.current !== requestId) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load products.');
      } finally {
        if (requestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [
      cursorMap,
      pageInfo.startCursor,
      fetchPage,
      initialItems,
      initialPageInfo,
      initialTotalCount,
      resolvePageData,
      setPageParam,
    ]
  );

  useEffect(() => {
    if (pendingPage && pendingPage === currentPage) {
      setPendingPage(null);
    }
  }, [currentPage, pendingPage]);

  useEffect(() => {
    loadPage(currentPage);
  }, [currentPage, loadPage]);

  const maxKnownPage = useMemo(() => getMaxKnownPage(cursorMap), [cursorMap]);
  const totalPages = useMemo(() => getTotalPages(totalCount, PAGE_SIZE), [totalCount]);
  const maxNavigablePage = useMemo(() => {
    if (!totalPages) return maxKnownPage;
    return Math.min(totalPages, maxKnownPage + MAX_CURSOR_STEPS);
  }, [maxKnownPage, totalPages]);
  const hasNextPage = totalPages ? activePage < totalPages : pageInfo.hasNextPage;
  const hasPreviousPage = activePage > 1;

  const showSkeleton = isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <FiltersBar
          facets={effectiveFacets}
          values={filters}
          onChange={(next) => updateSearchParams(next)}
          onClear={clearFilters}
        />
        <div className="flex items-center justify-between gap-4">
          <SortSelect value={{ sort, dir }} onChange={(next) => updateSearchParams(next)} />
        </div>
      </div>

      {showSkeleton ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`refresh-skeleton-${index}`}
              className="flex aspect-[3/4] w-full animate-pulse border border-border bg-muted"
            />
          ))}
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {displayItems.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 4} />
          ))}
          {!displayItems.length ? (
            <div className="col-span-full border border-border p-6 text-sm text-muted-foreground">
              No products found.
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}

      <Pagination
        page={activePage}
        maxKnownPage={maxKnownPage}
        maxNavigablePage={maxNavigablePage}
        totalPages={totalPages}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
