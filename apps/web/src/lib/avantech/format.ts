const normalizeLocale = (locale: string) => (locale === 'kg' ? 'ky' : locale);

export const formatPrice = (amount: number, locale: string, currencyLabel: string) => {
  const formatted = new Intl.NumberFormat(normalizeLocale(locale), { maximumFractionDigits: 0 }).format(amount);
  return `${formatted} ${currencyLabel}`;
};

export const formatDateTime = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(normalizeLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
