import { normalizeWhitespace } from './normalize';

const translitMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ғ: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  қ: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  ң: 'ng',
  о: 'o',
  ө: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ү: 'u',
  ұ: 'u',
  ф: 'f',
  х: 'h',
  һ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
};

const isAsciiAlphaNum = (char: string) => /[a-z0-9]/.test(char);

export const slugify = (value: string) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return '';
  let result = '';

  for (const char of normalized) {
    if (isAsciiAlphaNum(char)) {
      result += char;
      continue;
    }
    const mapped = translitMap[char];
    if (mapped) {
      result += mapped;
      continue;
    }
    result += '-';
  }

  return result.replace(/-+/g, '-').replace(/^-|-$/g, '');
};
