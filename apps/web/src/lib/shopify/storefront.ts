import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { shopifyFetch } from './client';
import {
  ALL_PRODUCTS_PAGE_QUERY,
  COLLECTIONS_QUERY,
  COLLECTIONS_PAGINATED_QUERY,
  COLLECTION_INFO_QUERY,
  COLLECTION_COLORS_QUERY,
  COLLECTION_PRODUCTS_COUNT_QUERY,
  COLLECTION_PRODUCTS_COUNT_SCAN_QUERY,
  COLLECTION_PRODUCTS_PAGE_QUERY,
  FEATURED_PRODUCTS_QUERY,
  FEATURED_PRODUCTS_PAGE_QUERY,
  LATEST_PRODUCTS_QUERY,
  LATEST_PRODUCTS_PAGE_QUERY,
  MENU_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCTS_BY_HANDLES_QUERY,
  PRODUCTS_COUNT_QUERY,
  SEARCH_PRODUCTS_PAGE_QUERY,
  SEARCH_SUGGESTIONS_QUERY,
} from './queries';
import { shopifyPaginate } from './paginate';
import {
  collectionSummarySchema,
  mapProductDetail,
  mapProductSummary,
  productDetailSchema,
  productSummarySchema,
  type CollectionSummary,
  type ProductDetail,
  type ProductSummary,
} from './schemas';
import { parseSortParams, sortToShopify } from './sort';
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from './constants';

export type CollectionDetail = CollectionSummary & { products: ProductSummary[] };

export type MenuItem = {
  title: string;
  url: string;
  items?: MenuItem[];
};

type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
};
export type ProductPage = { products: ProductSummary[]; pageInfo: PageInfo };
export type FeaturedPage = ProductPage & { mode: 'featured' | 'latest' };

export type ProductFilters = {
  brand?: string | null;
  availability?: 'in' | 'out' | null;
  color?: string | null;
};

type ProductFilterInput = {
  available?: boolean;
  productVendor?: string;
  tag?: string;
  variantOption?: {
    name: string;
    value: string;
  };
};

const REVALIDATE_SECONDS = 300;
const CARD_IMAGE_WIDTH = 800;
const COLLECTION_IMAGE_WIDTH = 1200;
const PRODUCT_IMAGE_WIDTH = 1400;
const COUNT_REVALIDATE_SECONDS = 600;
const COUNT_PAGE_SIZE = 250;
const COUNT_MAX_ITEMS = 5000;
const COUNT_MAX_PAGES = Math.ceil(COUNT_MAX_ITEMS / COUNT_PAGE_SIZE);

const escapeQueryValue = (value: string) => value.replace(/"/g, '\\"').trim();

const buildColorQuery = (color: string) => {
  const escaped = escapeQueryValue(color);
  if (!escaped) return null;
  return `(tag:"color:${escaped}" OR tag:"Color_${escaped}")`;
};

const buildBrandQuery = (brand: string) => {
  const escaped = escapeQueryValue(brand);
  if (!escaped) return null;
  return `tag:"${escaped}"`;
};

const buildSearchQuery = (params: {
  q?: string | null;
  handle?: string | null;
  filters?: ProductFilters;
}) => {
  const tokens: string[] = [];
  if (params.q) {
    const escaped = escapeQueryValue(params.q);
    if (escaped) tokens.push(escaped);
  }
  if (params.handle) {
    tokens.push(`collection:${escapeQueryValue(params.handle)}`);
  }
  if (params.filters?.brand) {
    const brandQuery = buildBrandQuery(params.filters.brand);
    if (brandQuery) tokens.push(brandQuery);
  }
  if (params.filters?.availability) {
    tokens.push(`available_for_sale:${params.filters.availability === 'in'}`);
  }
  if (params.filters?.color) {
    const colorQuery = buildColorQuery(params.filters.color);
    if (colorQuery) tokens.push(colorQuery);
  }
  return tokens.length ? tokens.join(' AND ') : null;
};

const buildProductFilters = (filters?: ProductFilters): ProductFilterInput[] => {
  const entries: ProductFilterInput[] = [];
  if (!filters) return entries;

  if (filters.availability) {
    entries.push({ available: filters.availability === 'in' });
  }

  if (filters.brand) {
    const trimmed = filters.brand.trim();
    if (trimmed) entries.push({ tag: trimmed });
  }

  if (filters.color) {
    const trimmedColor = filters.color.trim();
    if (trimmedColor) {
      entries.push({ variantOption: { name: 'Color', value: trimmedColor } });
    }
  }

  return entries;
};

const buildFiltersKey = (filters?: ProductFilters) => {
  if (!filters) return 'none';
  const brand = filters.brand?.trim().toLowerCase() ?? '';
  const availability = filters.availability ?? '';
  const color = filters.color?.trim().toLowerCase() ?? '';
  return `${brand}|${availability}|${color}`;
};

const colorsMetafieldSchema = z.union([z.array(z.string()), z.string()]);

const parseColorsValue = (value?: string | null) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = colorsMetafieldSchema.safeParse(JSON.parse(trimmed));
      if (parsed.success && Array.isArray(parsed.data)) {
        return parsed.data.map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // fall back to delimiter parsing
    }
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [trimmed];
};

const resolveCountContext = (country?: string, language?: string) => ({
  country: country ?? process.env.DEFAULT_COUNTRY ?? DEFAULT_COUNTRY,
  language: language ?? DEFAULT_LANGUAGE,
});

const scanProductsCount = async (query: string | null, country: string, language: string) => {
  let total = 0;
  let after: string | null = null;
  let pages = 0;

  while (pages < COUNT_MAX_PAGES) {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        edges: Array<{ cursor: string }>;
      };
    } = await shopifyFetch(PRODUCTS_COUNT_QUERY, {
      variables: {
        query: query ?? null,
        first: COUNT_PAGE_SIZE,
        after,
      },
      country,
      language,
      cache: 'force-cache',
      revalidate: COUNT_REVALIDATE_SECONDS,
      tags: ['shopify', 'products', 'count'],
    });

    const edges = data.products.edges ?? [];
    total += edges.length;
    pages += 1;

    if (!data.products.pageInfo.hasNextPage) {
      return total;
    }

    if (total >= COUNT_MAX_ITEMS) {
      return null;
    }

    after = data.products.pageInfo.endCursor ?? null;
    if (!after) {
      return total;
    }
  }

  return null;
};

const scanCollectionCount = async (
  handle: string,
  filters: ProductFilterInput[],
  country: string,
  language: string
) => {
  let total = 0;
  let after: string | null = null;
  let pages = 0;

  while (pages < COUNT_MAX_PAGES) {
    const data: {
      collectionByHandle: {
        products: {
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
          edges: Array<{ cursor: string }>;
        };
      } | null;
    } = await shopifyFetch(COLLECTION_PRODUCTS_COUNT_SCAN_QUERY, {
      variables: {
        handle,
        first: COUNT_PAGE_SIZE,
        after,
        filters: filters.length ? filters : null,
      },
      country,
      language,
      cache: 'force-cache',
      revalidate: COUNT_REVALIDATE_SECONDS,
      tags: ['shopify', 'collections', handle, 'count'],
    });

    if (!data.collectionByHandle) {
      return 0;
    }

    const edges = data.collectionByHandle.products.edges ?? [];
    total += edges.length;
    pages += 1;

    if (!data.collectionByHandle.products.pageInfo.hasNextPage) {
      return total;
    }

    if (total >= COUNT_MAX_ITEMS) {
      return null;
    }

    after = data.collectionByHandle.products.pageInfo.endCursor ?? null;
    if (!after) {
      return total;
    }
  }

  return null;
};

const getProductsCountCached = async (query: string | null, country: string, language: string) =>
  unstable_cache(
    () => scanProductsCount(query, country, language),
    ['shopify-products-count', query ?? 'all', country, language],
    { revalidate: COUNT_REVALIDATE_SECONDS }
  )();

const getCollectionCountCached = async (
  handle: string,
  filtersKey: string,
  filters: ProductFilterInput[],
  country: string,
  language: string
) =>
  unstable_cache(
    () => scanCollectionCount(handle, filters, country, language),
    ['shopify-collection-count', handle, filtersKey, country, language],
    { revalidate: COUNT_REVALIDATE_SECONDS }
  )();

export async function getCollections(
  params: { first?: number } = {},
  options?: { country?: string; language?: string }
) {
  const data = await shopifyFetch<{ collections: { nodes: CollectionSummary[] } }>(COLLECTIONS_QUERY, {
    variables: { first: params.first ?? 6, imageWidth: COLLECTION_IMAGE_WIDTH },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'collections'],
  });

  return data.collections.nodes.map((collection) => collectionSummarySchema.parse(collection));
}

export async function getAllCollections(options?: { country?: string; language?: string }) {
  const { nodes } = await shopifyPaginate<
    { collections: { nodes: CollectionSummary[]; pageInfo: PageInfo } },
    CollectionSummary
  >({
    query: COLLECTIONS_PAGINATED_QUERY,
    variables: { imageWidth: COLLECTION_IMAGE_WIDTH },
    getConnection: (data) => data.collections,
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'collections'],
  });

  return nodes.map((collection) => collectionSummarySchema.parse(collection));
}

export async function getAllProducts(options?: { country?: string; language?: string }) {
  const { nodes } = await shopifyPaginate<{ products: { nodes: unknown[]; pageInfo: PageInfo } }, unknown>({
    query: ALL_PRODUCTS_PAGE_QUERY,
    variables: { imageWidth: CARD_IMAGE_WIDTH },
    getConnection: (data) => data.products,
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  return nodes.map((product) => mapProductSummary(productSummarySchema.parse(product)));
}

export async function getCollectionTotalCount(params: {
  handle: string;
  filters?: ProductFilters;
  country?: string;
  language?: string;
}): Promise<number | null> {
  const hasFilters = Boolean(
    params.filters?.brand || params.filters?.availability || params.filters?.color
  );
  const { country, language } = resolveCountContext(params.country, params.language);

  if (!hasFilters) {
    try {
      const data = await shopifyFetch<{ collectionByHandle: { productsCount: number } | null }>(
        COLLECTION_PRODUCTS_COUNT_QUERY,
        {
          variables: { handle: params.handle },
          country: params.country,
          language: params.language,
          cache: 'force-cache',
          revalidate: COUNT_REVALIDATE_SECONDS,
          tags: ['shopify', 'collections', params.handle, 'count'],
        }
      );

      if (typeof data.collectionByHandle?.productsCount === 'number') {
        return data.collectionByHandle.productsCount;
      }
    } catch {
      // Fallback to search-count scan if the API version doesn't expose productsCount.
    }

    try {
      return await getCollectionCountCached(
        params.handle,
        buildFiltersKey(undefined),
        [],
        country,
        language
      );
    } catch {
      return null;
    }
  }

  const filters = buildProductFilters(params.filters);
  const filterKey = buildFiltersKey(params.filters);
  try {
    return await getCollectionCountCached(params.handle, filterKey, filters, country, language);
  } catch {
    return null;
  }
}

export async function getSearchTotalCount(params: {
  query?: string | null;
  filters?: ProductFilters;
  country?: string;
  language?: string;
}): Promise<number | null> {
  const query = buildSearchQuery({ q: params.query, filters: params.filters });
  const { country, language } = resolveCountContext(params.country, params.language);
  try {
    return await getProductsCountCached(query ?? null, country, language);
  } catch {
    return null;
  }
}

export async function getCollectionProductsPage(params: {
  handle: string;
  after?: string | null;
  before?: string | null;
  first?: number;
  last?: number;
  sort?: string | null;
  dir?: string | null;
  filters?: ProductFilters;
  country?: string;
  language?: string;
}) {
  const { sort, dir } = parseSortParams(params.sort, params.dir);
  const { sortKey, reverse } = sortToShopify(sort, dir, { mode: 'collection' });
  const isBackwards = Boolean(params.before);
  const first = isBackwards ? null : params.first ?? 24;
  const last = isBackwards ? params.last ?? params.first ?? 24 : null;
  const after = isBackwards ? null : params.after ?? null;
  const before = isBackwards ? params.before ?? null : null;
  const filters = buildProductFilters(params.filters);

  const data = await shopifyFetch<{
    collectionByHandle:
      | {
          products: {
            edges?: Array<{ cursor: string; node: unknown }>;
            nodes?: unknown[];
            pageInfo: PageInfo;
          };
        }
      | null;
  }>(COLLECTION_PRODUCTS_PAGE_QUERY, {
    variables: {
      handle: params.handle,
      first,
      after,
      last,
      before,
      filters: filters.length ? filters : null,
      sortKey,
      reverse,
      imageWidth: CARD_IMAGE_WIDTH,
    },
    country: params.country,
    language: params.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'collections', params.handle],
  });

  const edges = data.collectionByHandle?.products.edges ?? [];
  const products = edges.length ? edges.map((edge) => edge.node) : data.collectionByHandle?.products.nodes ?? [];
  const pageInfo =
    data.collectionByHandle?.products.pageInfo ??
    ({
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    } as PageInfo);

  const result = {
    products: products.map((product) => mapProductSummary(productSummarySchema.parse(product))),
    pageInfo,
  };

  return result;
}

export async function searchProductsPage(params: {
  query?: string | null;
  after?: string | null;
  before?: string | null;
  first?: number;
  last?: number;
  sort?: string | null;
  dir?: string | null;
  filters?: ProductFilters;
  country?: string;
  language?: string;
}): Promise<ProductPage> {
  const { sort, dir } = parseSortParams(params.sort, params.dir);
  const query = buildSearchQuery({ q: params.query, filters: params.filters });
  const { sortKey, reverse } = sortToShopify(sort, dir, { mode: 'search', hasQuery: !!query });
  const isBackwards = Boolean(params.before);
  const first = isBackwards ? null : params.first ?? 24;
  const last = isBackwards ? params.last ?? params.first ?? 24 : null;
  const after = isBackwards ? null : params.after ?? null;
  const before = isBackwards ? params.before ?? null : null;

  const data = await shopifyFetch<{
    products: { edges?: Array<{ cursor: string; node: unknown }>; nodes?: unknown[]; pageInfo: PageInfo };
  }>(
    SEARCH_PRODUCTS_PAGE_QUERY,
    {
      variables: {
        first,
        after,
        last,
        before,
        query,
        sortKey,
        reverse,
        imageWidth: CARD_IMAGE_WIDTH,
      },
      country: params.country,
      language: params.language,
      cache: 'force-cache',
      revalidate: REVALIDATE_SECONDS,
      tags: ['shopify', 'products', 'search'],
    }
  );

  const edges = data.products.edges ?? [];
  const products = edges.length ? edges.map((edge) => edge.node) : data.products.nodes ?? [];
  return {
    products: products.map((product) => mapProductSummary(productSummarySchema.parse(product))),
    pageInfo: data.products.pageInfo,
  };
}

export async function searchSuggestions(params: {
  query: string;
  country?: string;
  language?: string;
}) {
  const data = await shopifyFetch<{
    products: { nodes: unknown[] };
    collections: { nodes: unknown[] };
  }>(SEARCH_SUGGESTIONS_QUERY, {
    variables: { query: params.query, imageWidth: 200 },
    country: params.country,
    language: params.language,
    cache: 'force-cache',
    revalidate: 60,
    tags: ['shopify', 'search', 'suggestions'],
  });

  return {
    products: data.products.nodes.map((product) => mapProductSummary(productSummarySchema.parse(product))),
    collections: data.collections.nodes.map((collection) => collectionSummarySchema.parse(collection)),
  };
}

export async function getCollectionInfo(handle: string, options?: { country?: string; language?: string }) {
  const data = await shopifyFetch<{ collectionByHandle: CollectionSummary | null }>(COLLECTION_INFO_QUERY, {
    variables: { handle, imageWidth: COLLECTION_IMAGE_WIDTH },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'collections', handle],
  });

  if (!data.collectionByHandle) return null;
  return collectionSummarySchema.parse(data.collectionByHandle);
}

export async function getCollectionColors(
  handle: string,
  options?: { country?: string; language?: string }
): Promise<string[]> {
  const data = await shopifyFetch<{
    collectionByHandle:
      | {
          colors: { value?: string | null } | null;
          colorOptions: { value?: string | null } | null;
          colorsList: { value?: string | null } | null;
          colours: { value?: string | null } | null;
        }
      | null;
  }>(COLLECTION_COLORS_QUERY, {
    variables: { handle },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: COUNT_REVALIDATE_SECONDS,
    tags: ['shopify', 'collections', handle, 'colors'],
  });

  const primary = data.collectionByHandle?.colors?.value ?? null;
  const secondary = data.collectionByHandle?.colorOptions?.value ?? null;
  const tertiary = data.collectionByHandle?.colorsList?.value ?? null;
  const quaternary = data.collectionByHandle?.colours?.value ?? null;
  return parseColorsValue(primary ?? secondary ?? tertiary ?? quaternary);
}

export async function getCollectionByHandle(
  handle: string,
  params: { first?: number } = {},
  options?: { country?: string; language?: string }
): Promise<CollectionDetail | null> {
  const collection = await getCollectionInfo(handle, options);
  if (!collection) return null;
  const products = await getCollectionProductsPage({
    handle,
    country: options?.country,
    language: options?.language,
    first: params.first,
  });

  return { ...collection, products: products.products };
}

export async function getFeaturedProducts(
  params: { first?: number } = {},
  options?: { country?: string; language?: string }
) {
  const first = params.first ?? 8;
  const featured = await shopifyFetch<{ products: { nodes: unknown[] } }>(FEATURED_PRODUCTS_QUERY, {
    variables: { first, query: 'tag:featured', imageWidth: CARD_IMAGE_WIDTH },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'products', 'featured'],
  });

  const featuredProducts = featured.products.nodes.map((product) =>
    mapProductSummary(productSummarySchema.parse(product))
  );

  if (featuredProducts.length) return featuredProducts;

  const fallback = await shopifyFetch<{ products: { nodes: unknown[] } }>(LATEST_PRODUCTS_QUERY, {
    variables: { first, imageWidth: CARD_IMAGE_WIDTH },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'products', 'latest'],
  });

  return fallback.products.nodes.map((product) => mapProductSummary(productSummarySchema.parse(product)));
}

export async function getHomeFeaturedProductsPage(params: {
  after?: string | null;
  first?: number;
  mode?: 'featured' | 'latest';
  country?: string;
  language?: string;
}): Promise<FeaturedPage> {
  const first = params.first ?? 24;
  const mode = params.mode ?? 'featured';
  const pageQuery = mode === 'featured' ? FEATURED_PRODUCTS_PAGE_QUERY : LATEST_PRODUCTS_PAGE_QUERY;
  const variables =
    mode === 'featured'
      ? { first, after: params.after ?? null, query: 'tag:featured', imageWidth: CARD_IMAGE_WIDTH }
      : { first, after: params.after ?? null, imageWidth: CARD_IMAGE_WIDTH };

  const data = await shopifyFetch<{ products: { nodes: unknown[]; pageInfo: PageInfo } }>(pageQuery, {
    variables,
    country: params.country,
    language: params.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'products', mode],
  });

  const products = data.products.nodes.map((product) => mapProductSummary(productSummarySchema.parse(product)));

  if (!params.mode && mode === 'featured' && !params.after && products.length === 0) {
    const fallback = await shopifyFetch<{ products: { nodes: unknown[]; pageInfo: PageInfo } }>(
      LATEST_PRODUCTS_PAGE_QUERY,
      {
        variables: { first, after: null, imageWidth: CARD_IMAGE_WIDTH },
        country: params.country,
        language: params.language,
        cache: 'force-cache',
        revalidate: REVALIDATE_SECONDS,
        tags: ['shopify', 'products', 'latest'],
      }
    );

    return {
      products: fallback.products.nodes.map((product) =>
        mapProductSummary(productSummarySchema.parse(product))
      ),
      pageInfo: fallback.products.pageInfo,
      mode: 'latest',
    };
  }

  return { products, pageInfo: data.products.pageInfo, mode };
}

export async function getProductByHandle(
  handle: string,
  options?: { country?: string; language?: string }
): Promise<ProductDetail | null> {
  const data = await shopifyFetch<{ productByHandle: unknown | null }>(PRODUCT_BY_HANDLE_QUERY, {
    variables: { handle, imageWidth: PRODUCT_IMAGE_WIDTH },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'products', handle],
  });

  if (!data.productByHandle) return null;
  return mapProductDetail(productDetailSchema.parse(data.productByHandle));
}

export async function getProductsByHandles(
  handles: string[],
  options?: { country?: string; language?: string }
): Promise<ProductSummary[]> {
  const filtered = Array.from(new Set(handles.map((handle) => handle.trim()).filter(Boolean)));
  if (!filtered.length) return [];
  const variableDefs = filtered.map((_, index) => `$h${index}: String!`).join(', ');
  const fields = filtered
    .map(
      (_, index) => `
        p${index}: productByHandle(handle: $h${index}) {
          id
          handle
          title
          availableForSale
          featuredImage {
            url(transform: { maxWidth: $imageWidth })
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          vendor
          tags
          options {
            name
            values
          }
        }
      `
    )
    .join('\n');

  const query = `#graphql
    query ProductsByHandle(${variableDefs}, $imageWidth: Int!, $country: CountryCode!, $language: LanguageCode!)
      @inContext(country: $country, language: $language) {
      ${fields}
    }
  `;

  const variables: Record<string, string | number> = { imageWidth: CARD_IMAGE_WIDTH };
  filtered.forEach((handle, index) => {
    variables[`h${index}`] = handle;
  });

  const data = await shopifyFetch<Record<string, unknown | null>>(query, {
    variables,
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: REVALIDATE_SECONDS,
    tags: ['shopify', 'products', 'handles'],
  });

  return filtered
    .map((_, index) => data[`p${index}`])
    .filter(Boolean)
    .map((product) => mapProductSummary(productSummarySchema.parse(product)));
}

export async function getMenu(
  handle = 'main-menu',
  options?: { country?: string; language?: string }
): Promise<MenuItem[] | null> {
  try {
    const data = await shopifyFetch<{ menu: { items: MenuItem[] } | null }>(MENU_QUERY, {
      variables: { handle },
      country: options?.country,
      language: options?.language,
      cache: 'force-cache',
      revalidate: REVALIDATE_SECONDS,
      tags: ['shopify', 'menu', handle],
    });

    return data.menu?.items ?? null;
  } catch {
    return null;
  }
}
