import type { Money } from './schemas';

export const formatMoney = (money: Money, locale = 'en-GB') => {
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return `${money.amount} ${money.currencyCode}`;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  }).format(amount);
};
