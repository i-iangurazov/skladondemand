import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllProducts } from '@/lib/shopify/storefront';

const mockFetchSequence = (payloads: unknown[]) => {
  const fetchMock = vi.fn();
  payloads.forEach((payload) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const makeProduct = (id: string, handle: string) => ({
  id,
  handle,
  title: `Product ${handle}`,
  availableForSale: true,
  featuredImage: { url: 'https://example.com/image.jpg', altText: null },
  priceRange: {
    minVariantPrice: { amount: '10.00', currencyCode: 'GBP' },
    maxVariantPrice: { amount: '12.00', currencyCode: 'GBP' },
  },
});

describe('shopify pagination', () => {
  beforeEach(() => {
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'token';
    process.env.SHOPIFY_API_VERSION = '2025-01';
    process.env.DEFAULT_COUNTRY = 'GB';
  });

  it('fetches all pages for products', async () => {
    const fetchMock = mockFetchSequence([
      {
        data: {
          products: {
            nodes: [makeProduct('1', 'one'), makeProduct('2', 'two')],
            pageInfo: { hasNextPage: true, endCursor: 'c1' },
          },
        },
      },
      {
        data: {
          products: {
            nodes: [makeProduct('3', 'three')],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    ]);

    const products = await getAllProducts({ country: 'GB', language: 'EN' });

    expect(products).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
