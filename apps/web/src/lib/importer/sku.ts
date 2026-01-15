import { createHash } from 'crypto';
import { normalizeWhitespace } from './normalize';

const normalizeSkuSeed = (value: string) => normalizeWhitespace(value).toLowerCase();

export const normalizeSku = (value: string) =>
  normalizeWhitespace(value).replace(/\s+/g, '').toUpperCase();

export const generateStableSku = (parts: {
  category: string;
  product: string;
  label?: string;
  price?: number | string;
}) => {
  const seed = [parts.category, parts.product, parts.label ?? '', String(parts.price ?? '')]
    .map(normalizeSkuSeed)
    .join('|');
  return createHash('sha256').update(seed).digest('hex').toUpperCase();
};

export const generateFallbackSku = generateStableSku;
