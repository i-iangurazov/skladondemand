import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, Locale } from '@qr/db';
import { defaultLocale, isLanguage } from '@/lib/i18n';
import { getSessionUser } from '@/lib/auth/session';
import { dispatchOrderNotifications, processNotificationJobs } from '@/lib/notifications/jobs';

const payloadSchema = z.object({
  locale: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

type Messages = Record<string, unknown>;

const loadMessages = async (locale: string) => {
  const enMessages = (await import('@/messages/en.json')).default as Messages;
  if (locale === 'ru') {
    const ruMessages = (await import('@/messages/ru.json')).default as Messages;
    return { messages: ruMessages, fallback: enMessages };
  }
  if (locale === 'kg') {
    const kgMessages = (await import('@/messages/kg.json')).default as Messages;
    return { messages: kgMessages, fallback: enMessages };
  }
  return { messages: enMessages, fallback: enMessages };
};

const getMessage = (messages: Messages, path: string) => {
  const parts = path.split('.');
  let current: unknown = messages;
  for (const key of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
};

type Translation = { locale: Locale } & Record<string, unknown>;

const pickTranslation = <T extends Translation>(translations: T[], locale: Locale): T | undefined =>
  translations.find((t) => t.locale === locale) ??
  translations.find((t) => t.locale === Locale.ru) ??
  translations.find((t) => t.locale === Locale.en);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    const localeCandidate =
      body && typeof body === 'object' && 'locale' in body ? (body as { locale?: string }).locale : undefined;
    const locale = isLanguage(localeCandidate) ? localeCandidate : defaultLocale;
    const { messages, fallback } = await loadMessages(locale);
    const t = (key: string) => getMessage(messages, key) ?? getMessage(fallback, key) ?? key;
    return NextResponse.json({ message: t('avantech.telegram.invalidPayload') }, { status: 400 });
  }

  const language = isLanguage(parsed.data.locale) ? parsed.data.locale : defaultLocale;
  const locale = language as Locale;
  const { messages, fallback } = await loadMessages(language);
  const t = (key: string) => getMessage(messages, key) ?? getMessage(fallback, key) ?? key;
  const user = await getSessionUser(request);

  const uniqueVariantIds = Array.from(new Set(parsed.data.items.map((item) => item.variantId)));
  const variants = await prisma.variant.findMany({
    where: {
      id: { in: uniqueVariantIds },
      isActive: true,
      product: { isActive: true },
    },
    include: {
      translations: { where: { locale: { in: [locale, Locale.ru, Locale.en] } } },
      product: {
        include: {
          translations: { where: { locale: { in: [locale, Locale.ru, Locale.en] } } },
        },
      },
    },
  });

  const variantsById = Object.fromEntries(variants.map((variant) => [variant.id, variant]));

  let total = 0;
  const orderItems: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }> = [];

  parsed.data.items.forEach((item) => {
    const variant = variantsById[item.variantId];
    if (!variant) return;
    const productTranslation = pickTranslation(variant.product.translations, locale);
    const variantTranslation = pickTranslation(variant.translations, locale);
    const productName = productTranslation?.name ?? variant.productId;
    const variantLabel = variantTranslation?.label ?? variant.sku ?? variant.id;
    const unitPrice = variant.price;
    const subtotal = unitPrice * item.quantity;
    total += subtotal;

    orderItems.push({
      productName,
      variantLabel,
      quantity: item.quantity,
      unitPrice,
      subtotal,
    });
  });

  if (orderItems.length === 0) {
    return NextResponse.json({ message: t('avantech.telegram.empty') }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      userId: user?.id ?? null,
      locale: language,
      total,
      items: orderItems,
    },
  });

  await dispatchOrderNotifications(order.id);
  void processNotificationJobs({ orderId: order.id });

  return NextResponse.json({ ok: true, orderId: order.id });
}
