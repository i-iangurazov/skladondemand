import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLanguage, LOCALE_COOKIE } from './lib/i18n';
import { validateMessages } from './lib/i18n/checkMessages';

export default getRequestConfig(async () => {
  if (process.env.NODE_ENV !== 'production') {
    validateMessages();
  }

  const cookieStore = await cookies(); // <-- await here
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLanguage(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`./messages/${locale}.json`)).default;

  return { locale, messages, timeZone: 'Asia/Bishkek' };
});
