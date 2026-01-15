import { prisma } from '@qr/db';
import { formatPrice } from '@/lib/avantech/format';
import {
  buildOrderItemsSummary,
  buildOrderText,
  buildTranslator,
  resolveOrderLocale,
  type OrderLineItem,
  type OrderSnapshot,
  type OrderUserSnapshot,
} from './order';
import { sendTelegramMessage } from './telegram';
import { normalizeE164, sendWhatsAppWithFallback } from './whatsapp';

type NotificationChannel = 'TELEGRAM' | 'WHATSAPP';

type JobRequest = {
  mode?: 'template' | 'text';
  to?: string;
  text?: string;
  templateName?: string;
  templateLang?: string;
  components?: Array<{ type: 'body'; parameters: Array<{ type: 'text'; text: string }> }>;
};

const parseRecipients = () => {
  const raw = process.env.WHATSAPP_RECIPIENTS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeE164(value))
    .filter((value): value is string => Boolean(value));
};

const buildOrderTotals = (order: OrderSnapshot) => {
  const locale = resolveOrderLocale(order.locale);
  const t = buildTranslator(locale);
  const currencyLabel = t('common.labels.currency');
  return formatPrice(order.total, locale, currencyLabel);
};

const buildTemplateComponents = (order: OrderSnapshot, user?: OrderUserSnapshot | null) => {
  const locale = resolveOrderLocale(order.locale);
  const t = buildTranslator(locale);
  const summary = buildOrderItemsSummary(order.items);
  const totalText = buildOrderTotals(order);
  const guestLabel = t('avantech.telegram.customerGuest');
  return [
    {
      type: 'body' as const,
      parameters: [
        { type: 'text' as const, text: user?.name ?? guestLabel },
        { type: 'text' as const, text: user?.phone ?? '—' },
        { type: 'text' as const, text: user?.address ?? '—' },
        { type: 'text' as const, text: order.id },
        { type: 'text' as const, text: totalText },
        { type: 'text' as const, text: summary },
      ],
    },
  ];
};

const mapOrderSnapshot = (order: {
  id: string;
  createdAt: Date;
  locale: string | null;
  total: number;
  items: unknown;
}): OrderSnapshot => ({
  id: order.id,
  createdAt: order.createdAt,
  locale: order.locale,
  total: order.total,
  items: Array.isArray(order.items) ? (order.items as OrderLineItem[]) : [],
});

const loadOrderWithUser = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order) {
    throw new Error('Order not found.');
  }
  return {
    order: mapOrderSnapshot(order),
    user: order.user
      ? { name: order.user.name, phone: order.user.phone, address: order.user.address }
      : null,
  };
};

export const dispatchOrderNotifications = async (orderId: string) => {
  const { order, user } = await loadOrderWithUser(orderId);
  const orderText = buildOrderText({ order, user });

  const mode = process.env.WHATSAPP_MODE === 'text' ? 'text' : 'template';
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME_ORDER ?? '';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG ?? 'en';
  const recipients = parseRecipients();

  const jobs: Array<{
    orderId: string;
    channel: NotificationChannel;
    status: string;
    attempts: number;
    nextRunAt: Date;
    lastError?: string | null;
    requestJson: JobRequest;
  }> = [];

  jobs.push({
    orderId,
    channel: 'TELEGRAM',
    status: 'PENDING',
    attempts: 0,
    nextRunAt: new Date(),
    requestJson: { text: orderText },
  });

  if (!recipients.length) {
    jobs.push({
      orderId,
      channel: 'WHATSAPP',
      status: 'FAILED',
      attempts: 5,
      nextRunAt: new Date(),
      lastError: 'WHATSAPP_RECIPIENTS_MISSING',
      requestJson: { mode, text: orderText, templateName, templateLang },
    });
  } else {
    const components = buildTemplateComponents(order, user);
    recipients.forEach((to) => {
      jobs.push({
        orderId,
        channel: 'WHATSAPP',
        status: 'PENDING',
        attempts: 0,
        nextRunAt: new Date(),
        requestJson: {
          mode,
          to,
          text: orderText,
          templateName,
          templateLang,
          components,
        },
      });
    });
  }

  await prisma.orderNotificationJob.createMany({ data: jobs });
  return { enqueued: jobs.length };
};

export const processNotificationJobs = async (input?: { limit?: number; orderId?: string }) => {
  const limit = input?.limit ?? 10;
  const now = new Date();
  const jobs = await prisma.orderNotificationJob.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: 5 },
      nextRunAt: { lte: now },
      ...(input?.orderId ? { orderId: input.orderId } : {}),
    },
    orderBy: { nextRunAt: 'asc' },
    take: limit,
  });

  const result = { processed: jobs.length, sent: 0, failed: 0 };

  for (const job of jobs) {
    const attempts = job.attempts + 1;
    await prisma.orderNotificationJob.update({
      where: { id: job.id },
      data: { attempts },
    });

    try {
      const request = (job.requestJson && typeof job.requestJson === 'object'
        ? (job.requestJson as JobRequest)
        : {}) as JobRequest;

      if (job.channel === 'TELEGRAM') {
        let text = typeof request.text === 'string' ? request.text : '';
        if (!text) {
          const { order, user } = await loadOrderWithUser(job.orderId);
          text = buildOrderText({ order, user });
        }
        const response = await sendTelegramMessage(text);
        await prisma.orderNotificationJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            lastError: null,
            responseJson: response.responseJson,
            messageId: response.messageId,
          },
        });
        result.sent += 1;
        continue;
      }

      if (job.channel === 'WHATSAPP') {
        const mode = request.mode === 'text' ? 'text' : 'template';
        let text = typeof request.text === 'string' ? request.text : '';
        let to = typeof request.to === 'string' ? request.to : '';
        let templateName = typeof request.templateName === 'string' ? request.templateName : '';
        let templateLang = typeof request.templateLang === 'string' ? request.templateLang : '';
        let components = request.components;

        if (!text || !to || !templateName || !templateLang || !components) {
          const { order, user } = await loadOrderWithUser(job.orderId);
          text = text || buildOrderText({ order, user });
          to = to || '';
          templateName = templateName || process.env.WHATSAPP_TEMPLATE_NAME_ORDER || '';
          templateLang = templateLang || process.env.WHATSAPP_TEMPLATE_LANG || 'en';
          components = components || buildTemplateComponents(order, user);
        }

        if (!to) {
          throw new Error('WhatsApp recipient is missing.');
        }

        const response = await sendWhatsAppWithFallback({
          mode,
          toE164: to,
          text,
          templateName,
          templateLang,
          components,
        });
        await prisma.orderNotificationJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            lastError: null,
            responseJson: response.responseJson,
            messageId: response.messageId,
          },
        });
        result.sent += 1;
      }
    } catch (error) {
      const responseJson = (error as Error & { responseJson?: unknown }).responseJson;
      const backoffMinutes = Math.min(2 ** attempts, 60);
      await prisma.orderNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: error instanceof Error ? error.message : 'Notification failed.',
          responseJson,
          nextRunAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
        },
      });
      result.failed += 1;
    }
  }

  return result;
};
