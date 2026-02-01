import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCart, updateLines } from '@/lib/shopify/cart';

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

describe('shopify cart helpers', () => {
  beforeEach(() => {
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'token';
    process.env.SHOPIFY_API_VERSION = '2025-01';
    process.env.DEFAULT_COUNTRY = 'GB';
  });

  it('creates a cart and maps lines', async () => {
    mockFetch({
      data: {
        cartCreate: {
          cart: {
            id: 'cart-1',
            checkoutUrl: 'https://checkout',
            totalQuantity: 1,
            cost: {
              subtotalAmount: { amount: '10.00', currencyCode: 'GBP' },
              totalAmount: { amount: '10.00', currencyCode: 'GBP' },
              totalTaxAmount: null,
            },
            lines: {
              nodes: [
                {
                  id: 'line-1',
                  quantity: 1,
                  cost: {
                    amountPerQuantity: { amount: '10.00', currencyCode: 'GBP' },
                    totalAmount: { amount: '10.00', currencyCode: 'GBP' },
                  },
                  merchandise: {
                    id: 'variant-1',
                    title: 'Size M / Black',
                    selectedOptions: [{ name: 'Size', value: 'M' }],
                    product: {
                      handle: 'tee',
                      title: 'Tee',
                      featuredImage: { url: 'https://img', altText: null },
                    },
                  },
                },
              ],
            },
          },
          userErrors: [],
        },
      },
    });

    const cart = await createCart({ lines: [{ merchandiseId: 'variant-1', quantity: 1 }] });

    expect(cart.id).toBe('cart-1');
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].merchandise.product.title).toBe('Tee');
  });

  it('throws on user errors', async () => {
    mockFetch({
      data: {
        cartLinesUpdate: {
          cart: null,
          userErrors: [{ message: 'Invalid line' }],
        },
      },
    });

    await expect(updateLines('cart-1', [{ id: 'line-1', quantity: 2 }])).rejects.toThrow('Invalid line');
  });
});
