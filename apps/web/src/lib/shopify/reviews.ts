import 'server-only';

import { shopifyFetch } from './client';
import {
  LATEST_REVIEWS_METAOBJECTS_FALLBACK_QUERY,
  LATEST_REVIEWS_METAOBJECTS_QUERY,
  PRODUCTS_REVIEWS_METAFIELDS_QUERY,
  REVIEWS_METAOBJECTS_QUERY,
  REVIEWS_METAFIELDS_QUERY,
} from './queries';
import type {
  ProductReviewItem,
  ProductReviewsResult,
  ReviewCardModel,
} from './review-model';

export type Review = {
  rating: number;
  title: string;
  body: string;
  author: string;
  createdAt?: string | null;
  created_at?: string | null;
};

export type ReviewSummary = {
  averageRating?: number;
  ratingCount?: number;
  items: Review[];
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampRating = (value: number) => Math.max(1, Math.min(5, value));

type MetaobjectReference = {
  __typename?: string;
  image?: { url: string; altText?: string | null } | null;
  url?: string | null;
  handle?: string;
  title?: string;
};

type MetaobjectField = {
  key: string;
  value: string | null;
  reference?: MetaobjectReference | null;
  references?: { nodes?: MetaobjectReference[] } | null;
};

const normalizeProductReviews = (items: ProductReviewItem[]): ProductReviewsResult => {
  if (!items.length) {
    return { averageRating: null, ratingCount: null, items: [] };
  }
  const average = items.reduce((sum, review) => sum + review.rating, 0) / items.length;
  return {
    averageRating: Number.isFinite(average) ? average : null,
    ratingCount: items.length,
    items,
  };
};

const getFieldValue = (fields: MetaobjectField[], keys: string[]) => {
  for (const key of keys) {
    const value = fields.find((field) => field.key === key)?.value ?? null;
    if (value && value.trim()) return value;
  }
  return null;
};

const getReferencesByType = (fields: MetaobjectField[], type: string) => {
  const matches: MetaobjectReference[] = [];
  fields.forEach((field) => {
    if (field.reference?.__typename === type) matches.push(field.reference);
    field.references?.nodes?.forEach((node) => {
      if (node.__typename === type) matches.push(node);
    });
  });
  return matches;
};

const extractImageUrl = (references: MetaobjectReference[]) => {
  for (const ref of references) {
    if (ref.__typename === 'MediaImage' && ref.image?.url) return ref.image.url;
    if (ref.__typename === 'File' && ref.url) return ref.url;
  }
  return null;
};

const extractProduct = (fields: MetaobjectField[]) => {
  const productRefs = getReferencesByType(fields, 'Product');
  const reference = productRefs[0] as { handle?: string; title?: string } | undefined;
  if (reference?.handle && reference?.title) {
    return { handle: reference.handle, title: reference.title };
  }
  const handle = getFieldValue(fields, ['product_handle', 'productHandle', 'handle']);
  const title = getFieldValue(fields, ['product_title', 'productTitle', 'title']);
  if (handle && title) return { handle, title };
  if (handle) return { handle, title: handle };
  return null;
};

const parseMetaobjectReview = (node: { id: string; fields: MetaobjectField[] }): ReviewCardModel | null => {
  const ratingRaw =
    safeNumber(getFieldValue(node.fields, ['rating', 'score', 'stars'])) ??
    safeNumber(getFieldValue(node.fields, ['rating_value']));
  if (!ratingRaw || ratingRaw <= 0) return null;
  const rating = clampRating(ratingRaw);
  const body =
    getFieldValue(node.fields, ['body', 'text', 'content', 'review', 'comment', 'message']) ?? '';
  if (!body) return null;
  const author = getFieldValue(node.fields, ['author', 'name', 'reviewer']) ?? 'Anonymous';
  const createdAt = getFieldValue(node.fields, ['created_at', 'createdAt', 'date']) ?? null;
  const avatarRefs = getReferencesByType(node.fields, 'MediaImage').concat(
    getReferencesByType(node.fields, 'File')
  );
  const avatarUrl =
    extractImageUrl(avatarRefs) ??
    getFieldValue(node.fields, ['avatar', 'avatar_url', 'image', 'photo']);
  const product = extractProduct(node.fields);
  return {
    id: node.id,
    author,
    body,
    rating,
    createdAt,
    avatarUrl: avatarUrl ?? null,
    product,
  };
};

const fetchLatestMetaobjectReviews = async (
  params: { first: number },
  options?: { country?: string; language?: string }
) => {
  const base = {
    variables: { first: params.first, sortKey: 'UPDATED_AT' },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache' as const,
    revalidate: 300,
    tags: ['shopify', 'reviews', 'latest'],
  };

  try {
    const data = await shopifyFetch<{
      metaobjects: { nodes: Array<{ id: string; fields: MetaobjectField[] }> };
    }>(LATEST_REVIEWS_METAOBJECTS_QUERY, base);
    const mapped = data.metaobjects.nodes
      .map(parseMetaobjectReview)
      .filter((review): review is ReviewCardModel => Boolean(review));
    if (mapped.length) return mapped;
  } catch {
    // fallback to query without sortKey
  }

  try {
    const data = await shopifyFetch<{
      metaobjects: { nodes: Array<{ id: string; fields: MetaobjectField[] }> };
    }>(LATEST_REVIEWS_METAOBJECTS_FALLBACK_QUERY, {
      variables: { first: params.first },
      country: options?.country,
      language: options?.language,
      cache: 'force-cache',
      revalidate: 300,
      tags: ['shopify', 'reviews', 'latest'],
    });
    return data.metaobjects.nodes
      .map(parseMetaobjectReview)
      .filter((review): review is ReviewCardModel => Boolean(review));
  } catch {
    return [];
  }
};

const parseMetafieldItem = (item: Record<string, unknown>, product: { handle: string; title: string }) => {
  const rating = safeNumber(item.rating ?? item.score ?? item.stars ?? item.value ?? 0);
  if (!rating || rating <= 0) return null;
  const body =
    (item.body ?? item.text ?? item.content ?? item.review ?? item.comment ?? '')?.toString().trim() ?? '';
  if (!body) return null;
  const author = (item.author ?? item.name ?? item.reviewer ?? 'Anonymous')?.toString().trim() || 'Anonymous';
  const createdAt = (item.createdAt ?? item.created_at ?? item.date ?? null) as string | null;
  const avatarUrl = (item.avatarUrl ?? item.avatar ?? item.image ?? null) as string | null;
  return {
    id: `${product.handle}-${author}-${body.slice(0, 12)}`,
    author,
    body,
    rating: clampRating(rating),
    createdAt,
    avatarUrl,
    product,
  } as ReviewCardModel;
};

const fetchMetafieldLatestReviews = async (
  params: { first: number },
  options?: { country?: string; language?: string }
) => {
  const data = await shopifyFetch<{
    products: { nodes: Array<{ handle: string; title: string; items?: { value: string | null } | null }> };
  }>(PRODUCTS_REVIEWS_METAFIELDS_QUERY, {
    variables: { first: Math.max(10, params.first * 5) },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: 300,
    tags: ['shopify', 'reviews', 'latest'],
  });

  const items: ReviewCardModel[] = [];
  data.products.nodes.forEach((product) => {
    const raw = product.items?.value;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) return;
      parsed.forEach((entry) => {
        const mapped = parseMetafieldItem(entry, { handle: product.handle, title: product.title });
        if (mapped) items.push(mapped);
      });
    } catch {
      // ignore malformed JSON
    }
  });

  items.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

  return items.slice(0, params.first);
};

export async function getLatestReviews(
  params: { first?: number; country?: string; language?: string },
  options?: { country?: string; language?: string }
) {
  const first = Math.min(Math.max(params.first ?? 10, 4), 12);
  const country = params.country ?? options?.country;
  const language = params.language ?? options?.language;

  const metaobjects = await fetchLatestMetaobjectReviews({ first }, { country, language });
  if (metaobjects.length) return metaobjects;

  try {
    return await fetchMetafieldLatestReviews({ first }, { country, language });
  } catch {
    return [];
  }
}

const parseMetaobjectProductReview = (node: {
  id: string;
  fields: MetaobjectField[];
}): ProductReviewItem | null => {
  const ratingRaw =
    safeNumber(getFieldValue(node.fields, ['rating', 'score', 'stars'])) ??
    safeNumber(getFieldValue(node.fields, ['rating_value']));
  if (!ratingRaw || ratingRaw <= 0) return null;
  const body =
    getFieldValue(node.fields, ['body', 'text', 'content', 'review', 'comment', 'message']) ?? '';
  if (!body) return null;
  const title = getFieldValue(node.fields, ['title', 'headline']);
  const author = getFieldValue(node.fields, ['author', 'name', 'reviewer']) ?? 'Anonymous';
  const createdAt = getFieldValue(node.fields, ['created_at', 'createdAt', 'date']) ?? null;
  const avatarRefs = getReferencesByType(node.fields, 'MediaImage').concat(
    getReferencesByType(node.fields, 'File')
  );
  const avatarUrl =
    extractImageUrl(avatarRefs) ??
    getFieldValue(node.fields, ['avatar', 'avatar_url', 'image', 'photo']);

  return {
    id: node.id,
    rating: clampRating(ratingRaw),
    title,
    body,
    author,
    createdAt,
    avatarUrl: avatarUrl ?? null,
  };
};

const fetchMetaobjectProductReviews = async (
  params: { productHandle: string; productId?: string | null; first?: number },
  options?: { country?: string; language?: string }
): Promise<ProductReviewsResult | null> => {
  const queries = [
    `product_handle:${params.productHandle}`,
    params.productId ? `product_reference:${params.productId}` : null,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    const data = await shopifyFetch<{
      metaobjects: { nodes: Array<{ id: string; fields: MetaobjectField[] }> };
    }>(REVIEWS_METAOBJECTS_QUERY, {
      variables: { query, first: params.first ?? 20 },
      country: options?.country,
      language: options?.language,
      cache: 'force-cache',
      revalidate: 300,
      tags: ['shopify', 'reviews', params.productHandle],
    });

    const items = data.metaobjects.nodes
      .map(parseMetaobjectProductReview)
      .filter((review): review is ProductReviewItem => Boolean(review));
    if (items.length) return normalizeProductReviews(items);
  }

  return null;
};

const parseMetafieldProductItem = (item: Record<string, unknown>, productHandle: string, index: number) => {
  const rating = safeNumber(item.rating ?? item.score ?? item.stars ?? item.value ?? 0);
  if (!rating || rating <= 0) return null;
  const body =
    (item.body ?? item.text ?? item.content ?? item.review ?? item.comment ?? '')?.toString().trim() ?? '';
  if (!body) return null;
  const title = (item.title ?? item.headline ?? null) as string | null;
  const author = (item.author ?? item.name ?? item.reviewer ?? 'Anonymous')?.toString().trim() || 'Anonymous';
  const createdAt = (item.createdAt ?? item.created_at ?? item.date ?? null) as string | null;
  const avatarUrl = (item.avatarUrl ?? item.avatar ?? item.image ?? null) as string | null;
  return {
    id: `${productHandle}-${index}`,
    rating: clampRating(rating),
    title,
    body,
    author,
    createdAt,
    avatarUrl,
  } as ProductReviewItem;
};

const fetchMetafieldProductReviews = async (
  params: { productHandle: string; first?: number },
  options?: { country?: string; language?: string }
): Promise<ProductReviewsResult> => {
  const data = await shopifyFetch<{
    productByHandle: {
      average?: { value: string | null } | null;
      count?: { value: string | null } | null;
      items?: { value: string | null } | null;
    } | null;
  }>(REVIEWS_METAFIELDS_QUERY, {
    variables: { handle: params.productHandle },
    country: options?.country,
    language: options?.language,
    cache: 'force-cache',
    revalidate: 300,
    tags: ['shopify', 'reviews', params.productHandle],
  });

  if (!data.productByHandle) {
    return { averageRating: null, ratingCount: null, items: [] };
  }

  const averageRaw = data.productByHandle.average?.value ?? null;
  const countRaw = data.productByHandle.count?.value ?? null;
  const itemsRaw = data.productByHandle.items?.value ?? null;

  let items: ProductReviewItem[] = [];
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as Array<Record<string, unknown>>;
      if (Array.isArray(parsed)) {
        items = parsed
          .map((entry, index) => parseMetafieldProductItem(entry, params.productHandle, index))
          .filter((review): review is ProductReviewItem => Boolean(review));
      }
    } catch {
      items = [];
    }
  }

  const average = safeNumber(averageRaw);
  const count = safeNumber(countRaw);
  const normalized = normalizeProductReviews(items);
  return {
    averageRating: average ?? normalized.averageRating,
    ratingCount: count ?? normalized.ratingCount,
    items: normalized.items,
  };
};

export async function getProductReviews(params: {
  productHandle: string;
  productId?: string | null;
  country?: string;
  language?: string;
}): Promise<ProductReviewsResult> {
  try {
    const meta = await fetchMetaobjectProductReviews(
      {
        productHandle: params.productHandle,
        productId: params.productId ?? null,
        first: 20,
      },
      { country: params.country, language: params.language }
    );
    if (meta) return meta;
  } catch {
    // ignore metaobject failures and fall back to metafields
  }

  try {
    return await fetchMetafieldProductReviews(
      { productHandle: params.productHandle },
      { country: params.country, language: params.language }
    );
  } catch {
    return { averageRating: null, ratingCount: null, items: [] };
  }
}
