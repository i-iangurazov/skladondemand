import type { ProductSummary } from './schemas';

export type Facets = {
  brands: string[];
  colors: string[];
  brandMode: 'tag' | 'vendor';
  colorMode: 'metafield' | 'none';
};

const normalizeValue = (value: string) => value.trim();

const addUnique = (map: Map<string, string>, value?: string | null) => {
  if (!value) return;
  const trimmed = normalizeValue(value);
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (!map.has(key)) {
    map.set(key, trimmed);
  }
};

const normalizeLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const extractBrandTags = (tags: string[] = []) => {
  const brands: string[] = [];
  const blocked = new Set(['SALE', 'NEW', 'FEATURED', 'BESTSELLER', 'BEST-SELLER', 'BEST SELLER']);
  const isUpperBrand = (value: string) => /^[A-Z0-9]{2,12}$/.test(value);

  tags.forEach((tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('brand:') || lower.startsWith('brand_') || lower.startsWith('brand-')) {
      const value = trimmed.split(/[:_-]/).slice(1).join('').trim();
      if (value && !blocked.has(value.toUpperCase())) brands.push(trimmed);
      return;
    }
    if (isUpperBrand(trimmed) && !blocked.has(trimmed)) {
      brands.push(trimmed);
    }
  });
  return brands;
};

export const formatBrandLabel = (tag: string) => {
  const trimmed = tag.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('brand:')) {
    return normalizeLabel(trimmed.slice(trimmed.indexOf(':') + 1));
  }
  if (lower.startsWith('brand_')) {
    return normalizeLabel(trimmed.slice(trimmed.indexOf('_') + 1));
  }
  if (lower.startsWith('brand-')) {
    return normalizeLabel(trimmed.slice(trimmed.indexOf('-') + 1));
  }
  return normalizeLabel(trimmed);
};

export const extractTagColors = (tags: string[] = []) => {
  const colors: string[] = [];
  tags.forEach((tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('color:')) {
      const value = trimmed.split(':').slice(1).join(':').trim();
      if (value) colors.push(value);
      return;
    }
    if (lower.startsWith('color_')) {
      const value = trimmed.slice(trimmed.indexOf('_') + 1).replace(/_/g, ' ').trim();
      if (value) colors.push(value);
    }
  });
  return colors;
};

export const extractOptionColors = (options: ProductSummary['options'] = []) => {
  const colors: string[] = [];
  options.forEach((option) => {
    if (!option) return;
    if (option.name.trim().toLowerCase() !== 'color') return;
    option.values.forEach((value) => {
      const trimmed = value.trim();
      if (trimmed) colors.push(trimmed);
    });
  });
  return colors;
};

export const deriveCollectionColors = (facets: Facets, collectionColors: string[] = []) => {
  const normalizedCollection = collectionColors
    .map((color) => color.trim())
    .filter(Boolean);
  if (normalizedCollection.length) {
    return { ...facets, colors: normalizedCollection, colorMode: 'metafield' as const };
  }
  return { ...facets, colors: [], colorMode: 'none' as const };
};

export const extractColors = (product: ProductSummary) => {
  return extractTagColors(product.tags ?? []);
};

export const deriveFacets = (products: ProductSummary[]): Facets => {
  const brandsMap = new Map<string, string>();

  products.forEach((product) => {
    extractBrandTags(product.tags ?? []).forEach((brand) => addUnique(brandsMap, brand));
  });

  return {
    brands: Array.from(brandsMap.values()).sort((a, b) => a.localeCompare(b)),
    colors: [],
    brandMode: 'tag',
    colorMode: 'none',
  };
};
