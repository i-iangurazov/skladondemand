import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOrderText, type OrderSnapshot } from '../lib/notifications/order';
import { buildWhatsAppTemplatePayload, sendWhatsAppWithFallback, toDigitsOnly } from '../lib/notifications/whatsapp';

describe('order message builder', () => {
  it('includes a guest customer block when user is missing', () => {
    const order: OrderSnapshot = {
      id: 'order-1',
      createdAt: new Date('2024-01-01T10:00:00.000Z'),
      locale: 'en',
      total: 1200,
      items: [
        {
          productName: 'Valve',
          variantLabel: 'DN15',
          quantity: 2,
          unitPrice: 600,
          subtotal: 1200,
        },
      ],
    };

    const text = buildOrderText({ order, user: null });

    expect(text).toContain('Customer: Guest');
    expect(text).toContain('Total:');
  });

  it('truncates long item lists', () => {
    const items = Array.from({ length: 200 }, (_, index) => {
      const label = `Variant-${index}`;
      return {
        productName: `Product ${index} ${'X'.repeat(20)}`,
        variantLabel: label,
        quantity: 1,
        unitPrice: 10,
        subtotal: 10,
      };
    });

    const order: OrderSnapshot = {
      id: 'order-long',
      createdAt: new Date('2024-01-01T10:00:00.000Z'),
      locale: 'en',
      total: 2000,
      items,
    };

    const text = buildOrderText({ order, user: { name: 'Jane', phone: '+996700000000', address: null } });

    expect(text).toContain('...and');
    expect(text.length).toBeLessThanOrEqual(3500);
  });
});

describe('whatsapp helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  });

  it('strips digits for WhatsApp recipients', () => {
    expect(toDigitsOnly('+996 700-123-456')).toBe('996700123456');
  });

  it('builds template payloads', () => {
    const payload = buildWhatsAppTemplatePayload({
      to: '996700000000',
      templateName: 'new_order',
      lang: 'ru',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: 'Order' }],
        },
      ],
    });

    expect(payload.type).toBe('template');
    expect(payload.template.name).toBe('new_order');
    expect(payload.template.language.code).toBe('ru');
  });

  it('falls back to template when text requires approval', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN = 'token';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 131047, message: 'Template required.' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ messages: [{ id: 'msg-1' }] }),
      });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const response = await sendWhatsAppWithFallback({
      mode: 'text',
      toE164: '+996700000000',
      text: 'Hello',
      templateName: 'new_order',
      templateLang: 'ru',
      components: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse((fetchMock.mock.calls[1][1] as { body?: string }).body ?? '{}');
    expect(body.type).toBe('template');
    expect(response.messageId).toBe('msg-1');
  });
});
