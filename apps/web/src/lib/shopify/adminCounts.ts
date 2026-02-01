import 'server-only';

import { unstable_cache } from 'next/cache';
import { adminFetch } from './adminClient';
import { buildAdminProductsQuery } from './adminFilters';
import { getCollectionAdminIdByHandle } from './adminCatalog';

const PRODUCTS_COUNT_QUERY = `#graphql
  query ProductsCount($query: String!) {
    productsCount(query: $query) {
      count
    }
  }
`;

const fetchProductsCount = async (query: string) => {
  const data = await adminFetch<{ productsCount: { count: number } }>(PRODUCTS_COUNT_QUERY, { query });
  return data.productsCount.count;
};

const cacheProductsCount = async (cacheKey: string, query: string) =>
  unstable_cache(() => fetchProductsCount(query), ['shopify-admin-count', cacheKey], {
    revalidate: 600,
  })();

const toCollectionIdToken = (id: string) => {
  const match = id.match(/(\d+)\s*$/);
  return match ? match[1] : id;
};

export const getTotalCountForCollection = async (params: {
  handle: string;
  q?: string | null;
  brand?: string | null;
  avail?: 'in' | 'out' | null;
}): Promise<number | null> => {
  try {
    const collectionId = await getCollectionAdminIdByHandle(params.handle);
    if (!collectionId) return null;
    const collectionToken = toCollectionIdToken(collectionId);
    const query = buildAdminProductsQuery({
      q: params.q ?? null,
      collectionId: collectionToken,
      brand: params.brand ?? null,
      avail: params.avail ?? null,
    });
    const cacheKey = [params.handle, params.q ?? '', params.brand ?? '', params.avail ?? ''].join('|');
    return await cacheProductsCount(cacheKey, query);
  } catch {
    return null;
  }
};

export const getTotalCountForSearch = async (params: {
  q?: string | null;
  brand?: string | null;
  avail?: 'in' | 'out' | null;
}): Promise<number | null> => {
  try {
    const query = buildAdminProductsQuery({
      q: params.q ?? null,
      brand: params.brand ?? null,
      avail: params.avail ?? null,
    });
    const cacheKey = ['search', params.q ?? '', params.brand ?? '', params.avail ?? ''].join('|');
    return await cacheProductsCount(cacheKey, query);
  } catch {
    return null;
  }
};
