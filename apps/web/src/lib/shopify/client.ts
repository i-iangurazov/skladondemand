import 'server-only';

import { ensureServerEnv } from '@/lib/serverEnv';
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from './constants';

export type ShopifyFetchOptions = {
  variables?: Record<string, unknown>;
  country?: string;
  language?: string;
  cache?: RequestCache;
  revalidate?: number;
  tags?: string[];
};

const injectInContext = (query: string) => {
  if (query.includes('@inContext')) return query;
  return query.replace(
    /(query|mutation)(\s+[^{@]+)?(\s*\([^)]*\))?\s*\{/,
    '$1$2$3 @inContext(country: $country, language: $language) {'
  );
};

const getShopifyConfig = () => {
  ensureServerEnv();
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION;

  if (!storeDomain || !accessToken || !apiVersion) {
    throw new Error('Missing Shopify environment variables.');
  }

  return { storeDomain, accessToken, apiVersion };
};

export async function shopifyFetch<T>(query: string, options: ShopifyFetchOptions = {}) {
  const { storeDomain, accessToken, apiVersion } = getShopifyConfig();
  const { variables = {}, country, language, cache, revalidate, tags } = options;

  const contextualQuery = injectInContext(query);
  const body = JSON.stringify({
    query: contextualQuery,
    variables: {
      country: country ?? process.env.DEFAULT_COUNTRY ?? DEFAULT_COUNTRY,
      language: language ?? DEFAULT_LANGUAGE,
      ...variables,
    },
  });

  const response = await fetch(`https://${storeDomain}/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': accessToken,
    },
    body,
    cache: cache ?? (typeof revalidate === 'number' ? 'force-cache' : 'no-store'),
    next: tags || typeof revalidate === 'number' ? { tags, revalidate } : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify request failed: ${response.status} ${response.statusText} ${text}`.trim());
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    const message = json.errors.map((error) => error.message).join(' | ');
    throw new Error(`Shopify GraphQL error: ${message}`);
  }

  if (!json.data) {
    throw new Error('Shopify response missing data.');
  }

  return json.data;
}
