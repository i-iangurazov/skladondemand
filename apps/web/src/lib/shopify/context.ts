import 'server-only';

import { cookies } from 'next/headers';
import {
  CURRENCY_COOKIE,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  currencyToCountry,
  type SupportedCurrency,
} from './constants';

export const getCurrencyFromCookies = async (): Promise<SupportedCurrency> => {
  await cookies();
  return DEFAULT_CURRENCY;
};

export const getStorefrontContext = async () => {
  const currency = await getCurrencyFromCookies();
  const country =
    currencyToCountry[currency] ??
    process.env.DEFAULT_COUNTRY ??
    currencyToCountry[DEFAULT_CURRENCY];
  return { currency, country, language: DEFAULT_LANGUAGE };
};
