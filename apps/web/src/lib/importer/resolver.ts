import { normalizeWhitespace } from './normalize';
import { normalizeText, tokenizeName } from './variant';

const ATTR_KEYS = ['dn', 'diameter_mm', 'length_m', 'thread', 'size'] as const;

export const DEFAULT_MATCH_THRESHOLD = 0.82;
export const DEFAULT_AMBIGUOUS_GAP = 0.05;

type VariantLike = {
  id: string;
  sku?: string | null;
  attributes?: unknown;
  translations?: Array<{ locale?: string; label?: string }>;
};

type ProductLike = {
  id: string;
  slug?: string | null;
  translations?: Array<{ locale?: string; name?: string }>;
  variants?: VariantLike[];
};

type RowMatchInput = {
  baseName: string;
  label?: string;
  attrs?: Record<string, unknown>;
};

export type ProductMatch = {
  product: ProductLike;
  score: number;
  variantMatch?: VariantLike | null;
};

export type ProductMatchResolution = {
  matches: ProductMatch[];
  eligible: ProductMatch[];
  best: ProductMatch | null;
  ambiguous: boolean;
};

export const getRuName = (product: ProductLike) => {
  const ru = product.translations?.find((t) => t.locale === 'ru')?.name;
  if (ru) return ru;
  return product.translations?.[0]?.name ?? '';
};

const normalizeLabel = (value: string) =>
  normalizeWhitespace(value)
    .replace(/[•·]/g, ' ')
    .replace(/[×хХ]/g, 'x')
    .toLowerCase();

const normalizeAttrValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return normalizeWhitespace(value).toLowerCase();
  return null;
};

const compareAttrValues = (left: unknown, right: unknown) => {
  const leftValue = normalizeAttrValue(left);
  const rightValue = normalizeAttrValue(right);
  if (leftValue === null || rightValue === null) return false;
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return Math.abs(leftValue - rightValue) < 0.05;
  }
  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    return leftValue === rightValue;
  }
  return false;
};

const hasMatchingAttrs = (rowAttrs: Record<string, unknown> | undefined, variantAttrs: unknown) => {
  if (!rowAttrs || !variantAttrs || typeof variantAttrs !== 'object') return false;
  const candidate = variantAttrs as Record<string, unknown>;
  let checked = 0;
  let matched = 0;

  ATTR_KEYS.forEach((key) => {
    if (rowAttrs[key] === undefined) return;
    checked += 1;
    if (compareAttrValues(rowAttrs[key], candidate[key])) {
      matched += 1;
    }
  });

  if (!checked) return false;
  return matched === checked;
};

export const findVariantMatch = (product: ProductLike, row: RowMatchInput) => {
  if (!product.variants?.length) return null;
  const rowLabel = row.label ? normalizeLabel(row.label) : '';
  for (const variant of product.variants) {
    const variantLabel = variant.translations?.find((t) => t.locale === 'ru')?.label;
    if (rowLabel && variantLabel && normalizeLabel(variantLabel) === rowLabel) {
      return variant;
    }
    if (hasMatchingAttrs(row.attrs, variant.attributes)) {
      return variant;
    }
  }
  return null;
};

const jaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach((value) => {
    if (setB.has(value)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]);
  return union.size ? intersection / union.size : 0;
};

export const scoreNameSimilarity = (left: string, right: string) => {
  const tokensLeft = tokenizeName(left);
  const tokensRight = tokenizeName(right);
  let score = jaccard(tokensLeft, tokensRight);

  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (normalizedLeft && normalizedRight) {
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
      score = Math.max(score, 0.75);
    }
  }

  return score;
};

export const scoreProductMatch = (product: ProductLike, row: RowMatchInput) => {
  const ruName = getRuName(product);
  const nameScore = scoreNameSimilarity(row.baseName, ruName);
  const variantMatch = findVariantMatch(product, row);
  const score = Math.min(1, nameScore + (variantMatch ? 0.2 : 0));
  return { score, variantMatch };
};

export const findBestProductMatch = (products: ProductLike[], row: RowMatchInput) => {
  const matches: ProductMatch[] = products
    .map((product) => {
      const scored = scoreProductMatch(product, row);
      return { product, score: scored.score, variantMatch: scored.variantMatch };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches;
};

export const resolveProductMatch = (
  products: ProductLike[],
  row: RowMatchInput,
  options?: { threshold?: number; ambiguousGap?: number }
): ProductMatchResolution => {
  const threshold = options?.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const ambiguousGap = options?.ambiguousGap ?? DEFAULT_AMBIGUOUS_GAP;
  const matches = findBestProductMatch(products, row);
  const eligible = matches.filter((match) => match.score >= threshold);
  const best = eligible[0] ?? null;
  const second = eligible[1] ?? null;
  const ambiguous = Boolean(best && second && Math.abs(best.score - second.score) < ambiguousGap);

  return {
    matches,
    eligible,
    best: ambiguous ? null : best,
    ambiguous,
  };
};
