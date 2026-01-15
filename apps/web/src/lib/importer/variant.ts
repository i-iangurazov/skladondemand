import { createHash } from 'crypto';
import { normalizeWhitespace } from './normalize';
import { slugify } from './slug';

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  а: 'A',
  в: 'B',
  е: 'E',
  к: 'K',
  м: 'M',
  н: 'H',
  о: 'O',
  р: 'P',
  с: 'C',
  т: 'T',
  х: 'X',
  у: 'Y',
};

const normalizeNumberLabel = (value: string) => value.replace(',', '.');

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(normalizeNumberLabel(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanThreadLabel = (value: string) => normalizeWhitespace(value).replace(/\s+/g, ' ');

const buildLabelPart = (value: string) => normalizeWhitespace(value);

const uniquePush = (items: string[], value?: string) => {
  if (!value) return;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return;
  if (items.includes(normalized)) return;
  items.push(normalized);
};

export const normalizeText = (value: string) => {
  const normalized = normalizeWhitespace(value)
    .replace(/[«»“”„‟]/g, '"')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[×хХ]/g, 'x');
  let mapped = '';
  for (const char of normalized) {
    mapped += CYRILLIC_LOOKALIKES[char] ?? char;
  }
  return mapped.toUpperCase();
};

export type VariantExtraction = {
  baseNameRu: string;
  labelRu: string;
  attrs: {
    dn?: number;
    diameter_mm?: number;
    length_m?: number;
    thread?: string;
    size?: string;
    material?: string;
    color?: string;
  };
  confidence: number;
};

const detectColor = (value: string) => {
  const lower = value.toLowerCase();
  if (/(черн|чёрн)/.test(lower)) return 'черный';
  if (/бел/.test(lower)) return 'белый';
  if (/сер/.test(lower)) return 'серый';
  if (/красн/.test(lower)) return 'красный';
  if (/син/.test(lower)) return 'синий';
  if (/зел/.test(lower)) return 'зеленый';
  return undefined;
};

const detectMaterial = (value: string) => {
  const lower = value.toLowerCase();
  if (/(пп|ppr|pp-r|полипропил)/.test(lower)) return 'ppr';
  if (/(пвх|pvc)/.test(lower)) return 'pvc';
  if (/латун/.test(lower)) return 'латунь';
  if (/сталь/.test(lower)) return 'сталь';
  if (/мед|медь/.test(lower)) return 'медь';
  if (/алюм/.test(lower)) return 'алюминий';
  return undefined;
};

const removeVariantTokens = (value: string) => {
  const patterns: RegExp[] = [
    /\b(?:DN|ДУ)\s*[-:]?\s*\d+(?:[.,]\d+)?\b/gi,
    /[ФF]\s*[-:]?\s*\d+(?:[.,]\d+)?/gi,
    /\bD\s*[-:]?\s*\d+(?:[.,]\d+)?\s*(?:мм|mm)?(?=\s|$|[.,;:])/gi,
    /\b\d+(?:[.,]\d+)?\s*(?:мм|mm)(?=\s|$|[.,;:])/gi,
    /\b\d+(?:[.,]\d+)?\s*(?:м|m)(?=\s|$|[.,;:])/gi,
    /\b\d+(?:\s*\d\/\d|\/\d)\s*(?:"|″)?(?=\s|$|[.,;:])/gi,
    /\b\d+(?:[.,]\d+)?\s*[xх×]\s*\d+(?:[.,]\d+)?\b/gi,
  ];

  let next = value.replace(/[×хХ]/g, 'x');
  patterns.forEach((pattern) => {
    next = next.replace(pattern, ' ');
  });
  next = next.replace(/[\[\](),;:|/"]+/g, ' ');
  next = normalizeWhitespace(next);

  const tokens = next.split(' ').filter(Boolean);
  const deduped: string[] = [];
  const seen = new Set<string>();
  tokens.forEach((token) => {
    const lower = token.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    deduped.push(token);
  });
  return normalizeWhitespace(deduped.join(' '));
};

export const extractVariantAttributes = (nameRu: string): VariantExtraction => {
  const original = normalizeWhitespace(nameRu);
  if (!original) {
    return { baseNameRu: '', labelRu: '', attrs: {}, confidence: 0.1 };
  }

  const working = original.replace(/[×хХ]/g, 'x');
  const attrs: VariantExtraction['attrs'] = {};

  const dnMatch = working.match(/\b(?:DN|ДУ)\s*[-:]?\s*(\d+(?:[.,]\d+)?)/i);
  let dnLabel: string | undefined;
  if (dnMatch) {
    const value = parseNumber(dnMatch[1]);
    if (value !== null) attrs.dn = value;
    dnLabel = `DN${normalizeNumberLabel(dnMatch[1])}`;
  }

  const fMatch = working.match(/[ФF]\s*[-:]?\s*(\d+(?:[.,]\d+)?)/i);
  let diameterLabel: string | undefined;
  if (fMatch) {
    const value = parseNumber(fMatch[1]);
    if (value !== null) attrs.diameter_mm = value;
    diameterLabel = `Ф${normalizeNumberLabel(fMatch[1])}`;
  }

  const dMatch = working.match(/\bD\s*[-:]?\s*(\d+(?:[.,]\d+)?)(?:\s*(?:мм|mm))?/i);
  if (dMatch && !diameterLabel) {
    const value = parseNumber(dMatch[1]);
    if (value !== null && attrs.diameter_mm === undefined) attrs.diameter_mm = value;
    const suffix = /мм|mm/i.test(dMatch[0]) ? 'мм' : '';
    diameterLabel = `D${normalizeNumberLabel(dMatch[1])}${suffix}`;
  }

  const threadFraction = working.match(/\b(\d+\s*\d\/\d|\d\/\d)\s*(?:"|″)?/);
  const threadInches = working.match(/\b(\d+(?:[.,]\d+)?)\s*(?:"|″)(?=\s|$|[.,;:])/);
  let threadLabel: string | undefined;
  if (threadFraction) {
    const hasQuote = /["″]/.test(threadFraction[0]);
    const normalized = cleanThreadLabel(threadFraction[1]);
    threadLabel = hasQuote ? `${normalized}"` : normalized;
    attrs.thread = threadLabel;
  } else if (threadInches) {
    threadLabel = `${normalizeNumberLabel(threadInches[1])}"`;
    attrs.thread = threadLabel;
  }

  const lengthMatch = working.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:м|m)(?=\s|$|[.,;:])/i);
  let lengthLabel: string | undefined;
  if (lengthMatch) {
    const value = parseNumber(lengthMatch[1]);
    if (value !== null) attrs.length_m = value;
    lengthLabel = `${normalizeNumberLabel(lengthMatch[1])}м`;
  }

  const sizeMatch = working.match(/(\d+(?:[.,]\d+)?)\s*[xх×]\s*(\d+(?:[.,]\d+)?)/i);
  let sizeLabel: string | undefined;
  if (sizeMatch) {
    const a = normalizeNumberLabel(sizeMatch[1]);
    const b = normalizeNumberLabel(sizeMatch[2]);
    attrs.size = `${a}x${b}`;
    sizeLabel = attrs.size;
  }

  const color = detectColor(original);
  if (color) attrs.color = color;
  const material = detectMaterial(original);
  if (material) attrs.material = material;

  const labelParts: string[] = [];
  uniquePush(labelParts, dnLabel);
  uniquePush(labelParts, diameterLabel);
  uniquePush(labelParts, buildLabelPart(threadLabel ?? ''));
  uniquePush(labelParts, lengthLabel);
  uniquePush(labelParts, sizeLabel);

  const baseNameRu = removeVariantTokens(original) || original;
  const labelRu = labelParts.join(' • ');

  const attrCount = Object.values(attrs).filter((value) => value !== undefined).length;
  let confidence = 0.4 + Math.min(attrCount * 0.1, 0.4);
  if (!labelRu && attrCount === 0) confidence = 0.3;
  if (!baseNameRu) confidence = 0.2;

  return {
    baseNameRu,
    labelRu,
    attrs,
    confidence: Math.min(confidence, 0.95),
  };
};

export const buildProductKey = (categoryRu: string, baseNameRu: string) =>
  slugify(`${categoryRu}::${baseNameRu}`);

export const buildRowFingerprint = (params: {
  productKey: string;
  labelRu?: string;
  priceRetail?: number;
  unit?: string;
}) => {
  const seed = [
    params.productKey,
    params.labelRu ?? '',
    String(params.priceRetail ?? ''),
    normalizeWhitespace(params.unit ?? '').toLowerCase(),
  ].join('::');
  return createHash('sha1').update(seed).digest('hex');
};

export const generateVariantSku = (params: { productKey: string; labelRu?: string; unit?: string }) => {
  const seed = [
    params.productKey,
    params.labelRu ?? '',
    normalizeWhitespace(params.unit ?? '').toLowerCase(),
  ].join('::');
  const hash = createHash('sha1').update(seed).digest('hex').toUpperCase();
  return `GEN-${hash}`;
};

export const tokenizeName = (value: string) => {
  const normalized = normalizeText(value)
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [] as string[];
  return normalized.split(' ').filter((token) => token.length > 1);
};
