export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_COOKIE = 'storefront_currency';

export const DEFAULT_CURRENCY: SupportedCurrency = 'GBP';
export const DEFAULT_COUNTRY = 'GB' as const;
export const DEFAULT_LANGUAGE = 'EN' as const;
export const DEFAULT_PAGE_SIZE = 24;
export const EUR_COUNTRY = 'DE';

export const currencyToCountry: Record<SupportedCurrency, string> = {
  GBP: 'GB',
  USD: 'US',
  EUR: 'DE',
};
