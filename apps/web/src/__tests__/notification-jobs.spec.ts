import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
  },
  orderNotificationJob: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@qr/db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/notifications/telegram', () => ({
  sendTelegramMessage: vi.fn(),
}));

vi.mock('../lib/notifications/whatsapp', async () => {
  const actual = await vi.importActual<typeof import('../lib/notifications/whatsapp')>(
    '../lib/notifications/whatsapp'
  );
  return {
    ...actual,
    sendWhatsAppWithFallback: vi.fn(),
  };
});

import { dispatchOrderNotifications, processNotificationJobs } from '../lib/notifications/jobs';
import { sendTelegramMessage } from '../lib/notifications/telegram';
import { sendWhatsAppWithFallback } from '../lib/notifications/whatsapp';

describe('notification jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_RECIPIENTS = '+996700000000';
    process.env.WHATSAPP_TEMPLATE_NAME_ORDER = 'new_order';
    process.env.WHATSAPP_TEMPLATE_LANG = 'ru';
  });

  afterEach(() => {
    delete process.env.WHATSAPP_RECIPIENTS;
    delete process.env.WHATSAPP_TEMPLATE_NAME_ORDER;
    delete process.env.WHATSAPP_TEMPLATE_LANG;
  });

  it('dispatches telegram and whatsapp jobs', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      createdAt: new Date('2024-01-01T10:00:00.000Z'),
      locale: 'en',
      total: 500,
      items: [
        {
          productName: 'Valve',
          variantLabel: 'DN15',
          quantity: 1,
          unitPrice: 500,
          subtotal: 500,
        },
      ],
      user: { name: 'Jane', phone: '+996700000000', address: 'Main' },
    });

    prismaMock.orderNotificationJob.createMany.mockResolvedValue({ count: 2 });

    await dispatchOrderNotifications('order-1');

    expect(prismaMock.orderNotificationJob.createMany).toHaveBeenCalled();
    const jobs = prismaMock.orderNotificationJob.createMany.mock.calls[0][0].data;
    expect(jobs).toHaveLength(2);
    expect(jobs.some((job: { channel: string }) => job.channel === 'TELEGRAM')).toBe(true);
    expect(jobs.some((job: { channel: string }) => job.channel === 'WHATSAPP')).toBe(true);
  });

  it('processes pending jobs and marks them as sent', async () => {
    const now = new Date('2024-01-01T12:00:00.000Z');
    prismaMock.orderNotificationJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        orderId: 'order-1',
        channel: 'TELEGRAM',
        status: 'PENDING',
        attempts: 0,
        nextRunAt: now,
        requestJson: { text: 'Order text' },
      },
      {
        id: 'job-2',
        orderId: 'order-1',
        channel: 'WHATSAPP',
        status: 'PENDING',
        attempts: 0,
        nextRunAt: now,
        requestJson: {
          mode: 'template',
          to: '+996700000000',
          text: 'Order text',
          templateName: 'new_order',
          templateLang: 'ru',
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'Order' }] }],
        },
      },
    ]);

    prismaMock.orderNotificationJob.update.mockResolvedValue({});
    vi.mocked(sendTelegramMessage).mockResolvedValue({
      messageId: 'tg-1',
      responseJson: { ok: true },
    });
    vi.mocked(sendWhatsAppWithFallback).mockResolvedValue({
      messageId: 'wa-1',
      responseJson: { messages: [{ id: 'wa-1' }] },
    });

    const result = await processNotificationJobs({ limit: 5 });

    expect(result.sent).toBe(2);
    expect(sendTelegramMessage).toHaveBeenCalledWith('Order text');
    expect(sendWhatsAppWithFallback).toHaveBeenCalled();

    const sentUpdates = prismaMock.orderNotificationJob.update.mock.calls
      .map((call) => call[0].data)
      .filter((data) => data.status === 'SENT');
    expect(sentUpdates).toHaveLength(2);
  });
});
