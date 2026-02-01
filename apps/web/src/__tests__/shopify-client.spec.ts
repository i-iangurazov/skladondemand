import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shopifyFetch } from '@/lib/shopify/client';

const mockFetch = (payload: unknown, ok = true) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe('shopifyFetch', () => {
  beforeEach(() => {
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'token';
    process.env.SHOPIFY_API_VERSION = '2025-01';
    process.env.DEFAULT_COUNTRY = 'GB';
  });

  it('injects inContext and returns data', async () => {
    const fetchMock = mockFetch({ data: { shop: { name: 'Test shop' } } });

    const data = await shopifyFetch<{ shop: { name: string } }>('query Shop { shop { name } }');

    expect(data.shop.name).toBe('Test shop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as {
      query: string;
      variables: Record<string, string>;
    };
    expect(body.query).toContain('@inContext');
    expect(body.variables.country).toBe('GB');
    expect(body.variables.language).toBe('EN');
  });

  it('throws on GraphQL errors', async () => {
    mockFetch({ errors: [{ message: 'Boom' }] });
    await expect(shopifyFetch('query Shop { shop { name } }')).rejects.toThrow('Boom');
  });
});
