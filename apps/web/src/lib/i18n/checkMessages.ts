import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import kg from '@/messages/kg.json';

type Messages = Record<string, unknown>;

type LocaleMap = {
  en: Messages;
  ru: Messages;
  kg: Messages;
};

let validated = false;

const collectKeys = (obj: Messages, prefix = ''): string[] => {
  const keys: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Messages, nextKey));
    } else {
      keys.push(nextKey);
    }
  });
  return keys;
};

export function validateMessages() {
  if (validated) return;
  validated = true;

  const locales: LocaleMap = { en, ru, kg };
  const baseKeys = collectKeys(locales.en);

  (Object.keys(locales) as Array<keyof LocaleMap>).forEach((locale) => {
    if (locale === 'en') return;
    const localeKeys = new Set(collectKeys(locales[locale]));
    const missing = baseKeys.filter((key) => !localeKeys.has(key));
    if (missing.length > 0) {
      const message = `Missing ${missing.length} message key(s) in ${locale}: ${missing.join(', ')}`;
      console.error(message);
      throw new Error(message);
    }
  });
}
