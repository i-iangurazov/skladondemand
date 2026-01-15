import { formatDateTime, formatPrice } from '@/lib/avantech/format';
import { defaultLocale, isLanguage, type Language } from '@/lib/i18n';
import enMessages from '@/messages/en.json';
import ruMessages from '@/messages/ru.json';
import kgMessages from '@/messages/kg.json';

type Messages = Record<string, unknown>;

const messagesByLocale: Record<Language, Messages> = {
  en: enMessages as Messages,
  ru: ruMessages as Messages,
  kg: kgMessages as Messages,
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

export const buildTranslator = (locale: Language) => {
  const messages = messagesByLocale[locale] ?? messagesByLocale.en;
  const fallback = messagesByLocale.en;
  return (key: string) => getMessage(messages, key) ?? getMessage(fallback, key) ?? key;
};

const MAX_MESSAGE_LENGTH = 3500;

export type OrderLineItem = {
  productName: string;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderSnapshot = {
  id: string;
  createdAt: Date;
  locale?: string | null;
  total: number;
  items: OrderLineItem[];
};

export type OrderUserSnapshot = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};

const normalizeItems = (items: unknown): OrderLineItem[] => {
  if (!Array.isArray(items)) return [];
  const normalized: OrderLineItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const productName = typeof record.productName === 'string' ? record.productName : '';
    if (!productName) continue;
    const variantLabel = typeof record.variantLabel === 'string' ? record.variantLabel : null;
    const quantity = typeof record.quantity === 'number' && Number.isFinite(record.quantity) ? record.quantity : 0;
    const unitPrice = typeof record.unitPrice === 'number' && Number.isFinite(record.unitPrice) ? record.unitPrice : 0;
    const subtotal =
      typeof record.subtotal === 'number' && Number.isFinite(record.subtotal) ? record.subtotal : unitPrice * quantity;
    if (quantity <= 0) continue;
    normalized.push({ productName, variantLabel, quantity, unitPrice, subtotal });
  }
  return normalized;
};

const buildItemBlock = (item: OrderLineItem, locale: Language, currencyLabel: string) => {
  const unitPriceText = formatPrice(item.unitPrice, locale, currencyLabel);
  const subtotalText = formatPrice(item.subtotal, locale, currencyLabel);
  const label = item.variantLabel ? ` - ${item.variantLabel}` : '';
  return `${item.productName}${label}\n${item.quantity} x ${unitPriceText} = ${subtotalText}`;
};

const buildItemsSummary = (items: OrderLineItem[], maxItems = 3) => {
  if (!items.length) return '—';
  return items
    .slice(0, maxItems)
    .map((item) => {
      const label = item.variantLabel ? ` - ${item.variantLabel}` : '';
      return `${item.productName}${label} x${item.quantity}`;
    })
    .join(', ');
};

const buildMessage = (lines: string[]) => lines.join('\n');

const truncateItems = (
  headerLines: string[],
  totalLine: string,
  itemBlocks: string[]
) => {
  const buildWithItems = (items: string[], omitted: number) => {
    const lines = [...headerLines];
    lines.push(...items);
    if (omitted > 0) {
      lines.push(`...and ${omitted} more items`);
    }
    lines.push('', totalLine);
    return buildMessage(lines);
  };

  const full = buildWithItems(itemBlocks, 0);
  if (full.length <= MAX_MESSAGE_LENGTH) return full;

  for (let keep = itemBlocks.length - 1; keep >= 0; keep -= 1) {
    const omitted = itemBlocks.length - keep;
    const candidate = buildWithItems(itemBlocks.slice(0, keep), omitted);
    if (candidate.length <= MAX_MESSAGE_LENGTH) return candidate;
  }

  return buildWithItems([], itemBlocks.length);
};

export const buildOrderText = ({
  order,
  user,
}: {
  order: OrderSnapshot;
  user?: OrderUserSnapshot | null;
}) => {
  const locale = resolveOrderLocale(order.locale);
  const t = buildTranslator(locale);
  const currencyLabel = t('common.labels.currency');

  const items = normalizeItems(order.items);
  const itemBlocks = items.map((item) => buildItemBlock(item, locale, currencyLabel));

  const title = t('avantech.telegram.title');
  const dateLine = `${t('avantech.telegram.date')}: ${formatDateTime(order.createdAt, locale)}`;
  const totalLine = `${t('avantech.telegram.total')}: ${formatPrice(order.total, locale, currencyLabel)}`;

  const customerLines = user
    ? [
        `${t('avantech.telegram.customer')}:`,
        `${t('avantech.telegram.customerName')}: ${user.name ?? '—'}`,
        `${t('avantech.telegram.customerPhone')}: ${user.phone ?? '—'}`,
        `${t('avantech.telegram.customerAddress')}: ${user.address ?? '—'}`,
      ]
    : [`${t('avantech.telegram.customer')}: ${t('avantech.telegram.customerGuest')}`];

  const headerLines = [title, dateLine, '', ...customerLines, ''];

  return truncateItems(headerLines, totalLine, itemBlocks);
};

export const buildOrderItemsSummary = (items: OrderLineItem[]) =>
  buildItemsSummary(normalizeItems(items as unknown), 3);

export const resolveOrderLocale = (locale?: string | null): Language =>
  isLanguage(locale) ? (locale as Language) : defaultLocale;
