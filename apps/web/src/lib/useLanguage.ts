'use client';

import { useCallback, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { defaultLocale, isLanguage, LOCALE_COOKIE, LOCALE_STORAGE, type Language } from './i18n';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function useLanguage(): { lang: Language; setLang: (lang: Language) => void } {
  const locale = useLocale();
  const router = useRouter();
  const lang = isLanguage(locale) ? locale : defaultLocale;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(LOCALE_STORAGE);
    if (isLanguage(stored) && stored !== lang) {
      document.cookie = `${LOCALE_COOKIE}=${stored}; path=/; max-age=${COOKIE_MAX_AGE}`;
      router.refresh();
      return;
    }
    if (!stored) {
      const browser = navigator.language?.split('-')[0]?.toLowerCase();
      const normalized = browser === 'ky' ? 'kg' : browser;
      if (isLanguage(normalized) && normalized !== lang) {
        localStorage.setItem(LOCALE_STORAGE, normalized);
        document.cookie = `${LOCALE_COOKIE}=${normalized}; path=/; max-age=${COOKIE_MAX_AGE}`;
        router.refresh();
      }
    }
  }, [lang, router]);

  const setLang = useCallback(
    (next: Language) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE, next);
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}`;
      }
      router.refresh();
    },
    [router]
  );

  return { lang, setLang };
}
