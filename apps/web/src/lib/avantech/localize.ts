import type { Language, LocalizedText } from './types';

export const getLocalizedText = (value: LocalizedText | undefined, lang: Language): string | undefined => {
  if (!value) return undefined;
  return value[lang] ?? value.en;
};

export const getLocalizedTextRequired = (value: LocalizedText, lang: Language): string =>
  value[lang] ?? value.en;
