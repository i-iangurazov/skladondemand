import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchListingWithFallback } from '@/lib/shopify/listing';
import { getTotalCountForCollection, getTotalCountForSearch } from '@/lib/shopify/adminCounts';
import { DEFAULT_PAGE_SIZE } from '@/lib/shopify/constants';
import { type ProductFilters } from '@/lib/shopify/storefront';
import { buildAdminProductsQuery } from '@/lib/shopify/adminFilters';
import { normalizeHandle } from '@/lib/shopify/handle';
import { shopifyFetch } from '@/lib/shopify/client';
import { COLLECTION_PRODUCTS_COUNT_QUERY } from '@/lib/shopify/queries';
import { getCollectionAdminIdByHandle } from '@/lib/shopify/adminCatalog';
import { normalizeTotalCount } from '@/lib/shopify/pagination';

const allowedCountries = new Set(['GB', 'US', 'DE']);
const MAX_PAGE_SIZE = 36;

const paramsSchema = z.object({
  mode: z.enum(['collection', 'search', 'all']).optional(),
  handle: z.string().trim().max(120).optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().trim().max(200).optional(),
  direction: z.enum(['next', 'prev']).optional(),
  sort: z.string().trim().max(20).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  brand: z.string().trim().max(80).optional(),
  avail: z.enum(['in', 'out']).optional(),
  color: z.string().trim().max(40).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  country: z.string().trim().optional(),
  debug: z.string().optional(),
});

const cleanValue = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
  }

  const {
    mode,
    handle,
    q,
    cursor,
    direction,
    sort,
    dir,
    brand,
    avail,
    color,
    pageSize,
    country: countryParam,
    debug,
  } = parsed.data;

  const country = allowedCountries.has((countryParam ?? 'GB').toUpperCase())
    ? (countryParam ?? 'GB').toUpperCase()
    : 'GB';

  const normalizedHandle = normalizeHandle(handle);
  const effectiveMode =
    mode ??
    (normalizedHandle ? 'collection' : q ? 'search' : 'all');

  if (effectiveMode === 'collection' && !normalizedHandle) {
    return NextResponse.json({ error: 'Missing collection handle.' }, { status: 400 });
  }


  const cursorValue = cleanValue(cursor) ?? null;
  const directionValue = direction ?? 'next';

  const filters: ProductFilters = {
    brand: cleanValue(brand),
    availability: avail ?? null,
    color: effectiveMode === 'collection' ? cleanValue(color) : null,
  };

  if (directionValue === 'prev' && !cursorValue) {
    return NextResponse.json({ error: 'Missing cursor for previous page.' }, { status: 400 });
  }

  const { page } = await fetchListingWithFallback({
    mode: effectiveMode,
    handle: normalizedHandle ?? undefined,
    query: cleanValue(q) ?? null,
    after: directionValue === 'next' ? cursorValue : null,
    before: directionValue === 'prev' ? cursorValue : null,
    first: pageSize ?? DEFAULT_PAGE_SIZE,
    last: directionValue === 'prev' ? pageSize ?? DEFAULT_PAGE_SIZE : undefined,
    sort: sort ?? null,
    dir: dir ?? null,
    filters,
    country,
    language: 'EN',
  });

  const adminEnabled = Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  const hasFilters = Boolean(filters.brand || filters.availability || filters.color || cleanValue(q));
  let storefrontCount: number | null = null;
  if (effectiveMode === 'collection' && normalizedHandle && !hasFilters) {
    try {
      const data = await shopifyFetch<{ collectionByHandle: { productsCount: number } | null }>(
        COLLECTION_PRODUCTS_COUNT_QUERY,
        {
          variables: { handle: normalizedHandle },
          country,
          language: 'EN',
          cache: 'force-cache',
          revalidate: 300,
          tags: ['shopify', 'collections', normalizedHandle, 'count'],
        }
      );
      if (typeof data.collectionByHandle?.productsCount === 'number') {
        storefrontCount = data.collectionByHandle.productsCount;
      }
    } catch {
      storefrontCount = null;
    }
  }

  const adminCollectionId =
    adminEnabled && effectiveMode === 'collection' && normalizedHandle
      ? await getCollectionAdminIdByHandle(normalizedHandle)
      : null;
  const adminQueryUsed = adminEnabled
    ? buildAdminProductsQuery({
        q: cleanValue(q) ?? null,
        collectionId: adminCollectionId
          ? adminCollectionId.match(/(\d+)\s*$/)?.[1] ?? adminCollectionId
          : null,
        brand: filters.brand ?? null,
        avail: avail ?? null,
      })
    : null;
  const rawCount =
    storefrontCount !== null
      ? storefrontCount
      : adminEnabled && adminQueryUsed
        ? effectiveMode === 'collection' && normalizedHandle
          ? await getTotalCountForCollection({
              handle: normalizedHandle,
              q: cleanValue(q) ?? null,
              brand: filters.brand ?? null,
              avail: avail ?? null,
            })
          : await getTotalCountForSearch({
              q: cleanValue(q) ?? null,
              brand: filters.brand ?? null,
              avail: avail ?? null,
            })
        : null;
  const totalCount = normalizeTotalCount(rawCount);

  const payload: Record<string, unknown> = {
    items: page.products,
    pageInfo: page.pageInfo,
    totalCount,
  };

  if (debug === '1') {
    payload.adminEnabled = adminEnabled;
    payload.adminQueryUsed = adminQueryUsed;
    payload.rawCount = rawCount;
    payload.colorMetafieldKeysTried = ['custom.colors', 'custom.color_options', 'custom.colours', 'custom.colors_list'];
    payload.sampleBrandTags = page.products
      .flatMap((product) => product.tags ?? [])
      .slice(0, 20);
  }

  return NextResponse.json(payload);
}
