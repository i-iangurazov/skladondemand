import { NextResponse } from 'next/server';
import { shopifyPaginate } from '@/lib/shopify/paginate';
import { ALL_PRODUCTS_PAGE_QUERY } from '@/lib/shopify/queries';

type ProductNode = { handle?: string | null };
type PageInfo = { hasNextPage: boolean; endCursor?: string | null };

const allowedCountries = new Set(['GB', 'US', 'DE']);

const toPositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countryParam = (url.searchParams.get('country') ?? 'GB').toUpperCase();
  const country = allowedCountries.has(countryParam) ? countryParam : 'GB';
  const pageSize = Math.min(toPositiveInt(url.searchParams.get('pageSize'), 250), 250);
  const limitPages = toPositiveInt(url.searchParams.get('limitPages'), 50);

  const result = await shopifyPaginate<
    { products: { nodes: ProductNode[]; pageInfo: PageInfo } },
    ProductNode
  >({
    query: ALL_PRODUCTS_PAGE_QUERY,
    variables: { imageWidth: 600 },
    getConnection: (data) => data.products,
    country,
    language: 'EN',
    pageSize,
    maxPages: limitPages,
    cache: 'no-store',
  });

  const handles = result.nodes
    .map((node) => node?.handle)
    .filter((handle): handle is string => typeof handle === 'string' && handle.length > 0);

  return NextResponse.json({
    country,
    pageSize,
    limitPages,
    totalFetched: result.nodes.length,
    pages: result.pageInfoTrace,
    first10Handles: handles.slice(0, 10),
    last10Handles: handles.slice(-10),
    notes: [
      'Missing products are often not published to the Online Store sales channel.',
      'Draft or archived products do not appear in Storefront API results.',
      'Market restrictions can hide products based on the @inContext(country) setting.',
      'Query filters or search terms can exclude items; this debug route uses no filters.',
    ],
  });
}
