export const locales = ['en', 'ru', 'kg'] as const;
export type Language = (typeof locales)[number];

export const defaultLocale: Language = 'ru';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_STORAGE = 'qr_lang';

export const isLanguage = (value?: string | null): value is Language =>
  locales.includes(value as Language);
