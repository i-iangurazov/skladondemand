import 'server-only';

import { unstable_cache } from 'next/cache';
import { adminFetch } from './adminClient';
import { extractBrandTags, extractTagColors, formatBrandLabel } from './facets';
import { normalizeHandle } from './handle';

type GlobalFacets = {
  brands: string[];
  colors: string[];
  availability: ['in', 'out'];
  meta?: {
    sampleBrandTags: string[];
    scanQuery: string | null;
    colorMetafieldKey: string | null;
    rawColorValue: string | null;
    parsedColors: string[];
    colorMetafieldKeysTried: string[];
    colorSource?: ColorSource;
  };
};

type ColorSource = 'collection' | 'tag' | 'variant-metafield' | 'none';

const FACET_SCAN_QUERY = `#graphql
  query ProductsFacetScan($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          tags
          vendor
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const VARIANT_COLOR_SCAN_QUERY = `#graphql
  query VariantColorScan($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          metafield(namespace: "shopify", key: "color-pattern") {
            value
            type
            reference {
              __typename
              ... on Metaobject {
                id
                type
                handle
                fields {
                  key
                  value
                  type
                }
              }
            }
            references(first: 50) {
              nodes {
                __typename
                ... on Metaobject {
                  id
                  type
                  handle
                  fields {
                    key
                    value
                    type
                  }
                }
              }
            }
          }
          variants(first: 50) {
            nodes {
              metafield(namespace: "shopify", key: "color-pattern") {
                value
                type
                reference {
                  __typename
                  ... on Metaobject {
                    id
                    type
                    handle
                    fields {
                      key
                      value
                      type
                    }
                  }
                }
                references(first: 50) {
                  nodes {
                    __typename
                    ... on Metaobject {
                      id
                      type
                      handle
                      fields {
                        key
                        value
                        type
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const COLLECTION_COLORS_QUERY = `#graphql
  query CollectionColors($handle: String!) {
    collectionByHandle(handle: $handle) {
      customMetafields: metafields(first: 30, namespace: "custom") {
        nodes {
          namespace
          key
          type
          value
          references(first: 50) {
            nodes {
              __typename
              ... on Metaobject {
                id
                type
                handle
                fields {
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
      filterMetafields: metafields(first: 30, namespace: "filters") {
        nodes {
          namespace
          key
          type
          value
          references(first: 50) {
            nodes {
              __typename
              ... on Metaobject {
                id
                type
                handle
                fields {
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
      allMetafields: metafields(first: 50) {
        nodes {
          namespace
          key
          type
          value
          references(first: 50) {
            nodes {
              __typename
              ... on Metaobject {
                id
                type
                handle
                fields {
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
    }
  }
`;

const PAGE_SIZE = 250;
const MAX_PRODUCTS = 2000;
const MAX_UNIQUES = 50;

const COLOR_KEY_CANDIDATES = [
  'custom.colors',
  'custom.color_options',
  'custom.colours',
  'custom.colors_list',
  'custom.color_list',
  'custom.color',
  'custom.colour',
  'filters.colors',
  'filters.colours',
  'filters.color_options',
  'filters.color_list',
  'filters.color',
  'shopify.color-pattern',
];

const VARIANT_COLOR_KEY = 'shopify.color-pattern';

const BLOCKED_BRANDS = new Set([
  'SALE',
  'NEW',
  'FEATURED',
  'BESTSELLER',
  'BEST-SELLER',
  'BEST SELLER',
  'MEN',
  'WOMEN',
  'KIDS',
  'UNISEX',
  'ACCESSORIES',
]);

const isBlockedBrand = (tag: string) => {
  const normalized = formatBrandLabel(tag).toUpperCase();
  return BLOCKED_BRANDS.has(tag.toUpperCase()) || BLOCKED_BRANDS.has(normalized);
};

const buildFacetQuery = (params: { handle?: string | null; q?: string | null }) => {
  const tokens: string[] = [];
  if (params.handle) {
    tokens.push(`collection:${params.handle}`);
  }
  if (params.q) {
    const trimmed = params.q.trim();
    if (trimmed) tokens.push(trimmed.includes(' ') ? `"${trimmed}"` : trimmed);
  }
  return tokens.length ? tokens.join(' AND ') : null;
};

const scanFacetTags = async (query: string | null, collectColors: boolean) => {
  const brandSet = new Set<string>();
  const colorSet = new Set<string>();
  const sampleBrandTags: string[] = [];
  let after: string | null = null;
  let scanned = 0;

  while (scanned < MAX_PRODUCTS) {
    const data: {
      products: {
        edges: Array<{ node: { tags: string[]; vendor?: string | null } }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    } = await adminFetch(FACET_SCAN_QUERY, {
      first: PAGE_SIZE,
      after,
      query,
    });

    const edges = data.products.edges ?? [];
    if (!edges.length) break;
    scanned += edges.length;

    edges.forEach(({ node }) => {
      const tags = node.tags ?? [];
      if (!sampleBrandTags.length && tags.length) {
        sampleBrandTags.push(...tags.slice(0, 20));
      }
      extractBrandTags(tags)
        .filter((tag) => !isBlockedBrand(tag))
        .forEach((tag) => brandSet.add(tag));
      if (collectColors) {
        extractTagColors(tags).forEach((color) => colorSet.add(color));
      }
      // vendor fallback intentionally removed; brands must come from tags only
    });

    if (!data.products.pageInfo.hasNextPage) break;
    if (brandSet.size >= MAX_UNIQUES && (!collectColors || colorSet.size >= MAX_UNIQUES)) {
      break;
    }
    const nextCursor = data.products.pageInfo.endCursor ?? null;
    if (!nextCursor) break;
    after = nextCursor;
  }

  return { brandSet, colorSet, sampleBrandTags };
};

const formatBrandList = (brands: Set<string>) =>
  Array.from(brands).sort((a, b) => formatBrandLabel(a).localeCompare(formatBrandLabel(b)));

const getAvailabilityFacet = (): ['in', 'out'] => ['in', 'out'];

const parseColorsValue = (value?: string | null) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [trimmed];
};

const extractColorFromJson = (input: unknown): string[] => {
  if (typeof input === 'string') return [input.trim()].filter(Boolean);
  if (Array.isArray(input)) {
    return input
      .flatMap((item) => extractColorFromJson(item))
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const keys = ['name', 'label', 'title', 'value', 'color', 'colour'];
    for (const key of keys) {
      const raw = record[key];
      if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    }
    const colors = record.colors;
    if (Array.isArray(colors)) {
      return colors
        .flatMap((item) => extractColorFromJson(item))
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const parseVariantColorValue = (value?: string | null) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const extracted = extractColorFromJson(parsed);
      if (extracted.length) return extracted;
    } catch {
      // fall through
    }
  }
  return [trimmed];
};

type VariantMetafield = {
  value?: string | null;
  reference?: MetaobjectNode | null;
  references?: { nodes?: MetaobjectNode[] } | null;
};

const parseMetafieldMetaobjects = (metafield?: VariantMetafield | null) => {
  if (!metafield) return [];
  const nodes: MetaobjectNode[] = [];
  if (metafield.reference) nodes.push(metafield.reference);
  if (metafield.references?.nodes?.length) nodes.push(...metafield.references.nodes);
  const fromRefs = extractColorsFromMetaobjects(nodes.filter(isColorMetaobject));
  if (fromRefs.length) return fromRefs;
  return [];
};

const scanVariantColors = async (query: string | null) => {
  const colorSet = new Set<string>();
  let after: string | null = null;
  let scanned = 0;

  while (scanned < MAX_PRODUCTS) {
    const data: {
      products: {
        edges: Array<{
          node: {
            metafield?: VariantMetafield | null;
            variants?: { nodes?: Array<{ metafield?: VariantMetafield | null }> } | null;
          };
        }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    } = await adminFetch(VARIANT_COLOR_SCAN_QUERY, {
      first: PAGE_SIZE,
      after,
      query,
    });

    const edges = data.products.edges ?? [];
    if (!edges.length) break;
    scanned += edges.length;

    edges.forEach(({ node }) => {
      const productMetaColors = parseMetafieldMetaobjects(node.metafield);
      if (productMetaColors.length) {
        productMetaColors.forEach((color) => colorSet.add(color));
      } else {
        const productValueColors = parseVariantColorValue(node.metafield?.value ?? null);
        productValueColors.forEach((color) => colorSet.add(color));
      }
      const variants = node.variants?.nodes ?? [];
      variants.forEach((variant) => {
        const metaColors = parseMetafieldMetaobjects(variant.metafield);
        if (metaColors.length) {
          metaColors.forEach((color) => colorSet.add(color));
          return;
        }
        const colors = parseVariantColorValue(variant.metafield?.value ?? null);
        colors.forEach((color) => colorSet.add(color));
      });
    });

    if (colorSet.size >= MAX_UNIQUES) break;
    if (!data.products.pageInfo.hasNextPage) break;
    const nextCursor = data.products.pageInfo.endCursor ?? null;
    if (!nextCursor) break;
    after = nextCursor;
  }

  return colorSet;
};

type MetaobjectField = { key: string; value: string | null; type?: string | null };
type MetaobjectNode = {
  __typename?: string;
  id?: string;
  type?: string;
  handle?: string | null;
  fields?: MetaobjectField[];
};
type MetafieldNode = {
  key: string;
  type?: string | null;
  value?: string | null;
  references?: { nodes?: MetaobjectNode[] } | null;
  namespace?: 'custom' | 'filters';
};

const METAOBJECT_COLOR_KEYS = ['label', 'name', 'title', 'value', 'color', 'colour'];
const COLOR_METAOBJECT_TYPES = ['shopify--color-pattern', 'color', 'colour'];

const extractColorsFromMetaobjects = (nodes: MetaobjectNode[] = []) => {
  const values: string[] = [];
  nodes.forEach((node) => {
    if (node.__typename && node.__typename !== 'Metaobject') return;
    const fields = node.fields ?? [];
    if (!fields.length) return;
    const preferred = fields.find((field) =>
      METAOBJECT_COLOR_KEYS.includes(field.key.toLowerCase())
    );
    const candidates = preferred ? [preferred] : fields.length === 1 ? [fields[0]] : [];
    candidates.forEach((field) => {
      const raw = field.value ?? '';
      if (raw) values.push(raw);
    });
  });
  return values;
};

const isColorMetaobject = (node: MetaobjectNode) => {
  const type = node.type?.toLowerCase() ?? '';
  if (!type) return false;
  return COLOR_METAOBJECT_TYPES.some((candidate) => type.includes(candidate));
};

const resolveColorMetafields = (nodes: MetafieldNode[]) => {
  if (!nodes.length) {
    return { colors: [], key: null, raw: null, keysTried: COLOR_KEY_CANDIDATES };
  }

  const nodeByKey = new Map<string, MetafieldNode>();
  nodes.forEach((node) => {
    if (!node.namespace) return;
    nodeByKey.set(`${node.namespace}.${node.key}`, node);
  });

  const ordered: Array<{ key: string; node: MetafieldNode }> = [];
  COLOR_KEY_CANDIDATES.forEach((key) => {
    const node = nodeByKey.get(key);
    if (node) ordered.push({ key, node });
  });

  if (!ordered.length) {
    nodes
      .filter((node) => node.key.toLowerCase().includes('color'))
      .forEach((node) => {
        const key = `${node.namespace}.${node.key}`;
        ordered.push({ key, node });
      });
  }

  for (const entry of ordered) {
    const metaNodes = entry.node.references?.nodes ?? [];
    const fromRefs = extractColorsFromMetaobjects(metaNodes);
    if (fromRefs.length) {
      return {
        colors: fromRefs,
        key: entry.key,
        raw: entry.node.value ?? null,
        keysTried: COLOR_KEY_CANDIDATES,
      };
    }
    const parsed = parseColorsValue(entry.node.value ?? null);
    if (parsed.length) {
      return {
        colors: parsed,
        key: entry.key,
        raw: entry.node.value ?? null,
        keysTried: COLOR_KEY_CANDIDATES,
      };
    }
  }

  // Fallback: any metafield referencing color metaobjects, regardless of key name.
  for (const node of nodes) {
    const metaNodes = node.references?.nodes ?? [];
    if (!metaNodes.length) continue;
    const colorRefs = metaNodes.filter(isColorMetaobject);
    if (!colorRefs.length) continue;
    const extracted = extractColorsFromMetaobjects(colorRefs);
    if (!extracted.length) continue;
    const key = node.namespace ? `${node.namespace}.${node.key}` : node.key;
    return {
      colors: extracted,
      key,
      raw: node.value ?? null,
      keysTried: COLOR_KEY_CANDIDATES,
    };
  }

  return { colors: [], key: null, raw: null, keysTried: COLOR_KEY_CANDIDATES };
};

const fetchCollectionColors = async (handle: string) => {
  const data = await adminFetch<{
    collectionByHandle:
      | {
          customMetafields?: { nodes?: MetafieldNode[] } | null;
          filterMetafields?: { nodes?: MetafieldNode[] } | null;
          allMetafields?: { nodes?: MetafieldNode[] } | null;
        }
      | null;
  }>(COLLECTION_COLORS_QUERY, { handle });

  const collection = data.collectionByHandle;
  if (!collection) {
    return { colors: [], key: null, raw: null, keysTried: COLOR_KEY_CANDIDATES };
  }

  const customNodes = collection.customMetafields?.nodes ?? [];
  const filterNodes = collection.filterMetafields?.nodes ?? [];
  const allNodes = collection.allMetafields?.nodes ?? [];
  return resolveColorMetafields([...customNodes, ...filterNodes, ...allNodes]);
};

const fetchCollectionFacets = async (handle: string) => {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) {
    return {
      brands: [],
      colors: [],
      availability: getAvailabilityFacet(),
      meta: {
        sampleBrandTags: [],
        scanQuery: null,
      colorMetafieldKey: null,
      rawColorValue: null,
      parsedColors: [],
      colorMetafieldKeysTried: COLOR_KEY_CANDIDATES,
      colorSource: 'none',
    },
  } as GlobalFacets;
}

  const collectionColorData = await fetchCollectionColors(normalizedHandle);
  const needsColorScan = collectionColorData.colors.length === 0;
  const scanQuery = buildFacetQuery({ handle: normalizedHandle });
  const { brandSet, colorSet, sampleBrandTags } = await scanFacetTags(scanQuery, needsColorScan);

  const brands = brandSet.size ? formatBrandList(brandSet) : [];
  let colors = collectionColorData.colors.length
    ? collectionColorData.colors.slice().sort((a, b) => a.localeCompare(b))
    : Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  let colorSource: ColorSource = collectionColorData.colors.length
    ? 'collection'
    : colorSet.size
      ? 'tag'
      : 'none';

  return {
    brands,
    colors,
    availability: getAvailabilityFacet(),
    meta: {
      sampleBrandTags,
      scanQuery,
      colorMetafieldKey: collectionColorData.key,
      rawColorValue: collectionColorData.raw,
      parsedColors:
        colorSource === 'collection'
          ? collectionColorData.colors
          : colorSource === 'tag'
            ? Array.from(colorSet)
            : colors,
      colorMetafieldKeysTried: collectionColorData.keysTried ?? COLOR_KEY_CANDIDATES,
      colorSource,
    },
  } as GlobalFacets;
};

const fetchSearchFacets = async (query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      brands: [],
      colors: [],
      availability: getAvailabilityFacet(),
      meta: {
        sampleBrandTags: [],
        scanQuery: null,
      colorMetafieldKey: null,
      rawColorValue: null,
      parsedColors: [],
      colorMetafieldKeysTried: COLOR_KEY_CANDIDATES,
      colorSource: 'none',
    },
  } as GlobalFacets;
  }
  const scanQuery = buildFacetQuery({ q: normalizedQuery });
  const { brandSet, colorSet, sampleBrandTags } = await scanFacetTags(scanQuery, true);
  const brands = brandSet.size ? formatBrandList(brandSet) : [];
  let colors = Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  let colorSource: ColorSource = colorSet.size ? 'tag' : 'none';

  return {
    brands,
    colors,
    availability: getAvailabilityFacet(),
    meta: {
      sampleBrandTags,
      scanQuery,
      colorMetafieldKey: null,
      rawColorValue: null,
      parsedColors: colorSource === 'tag' ? Array.from(colorSet) : colors,
      colorMetafieldKeysTried: COLOR_KEY_CANDIDATES,
      colorSource,
    },
  } as GlobalFacets;
};

export const getGlobalFacetsForCollection = async (
  handle: string,
  options?: { country?: string; language?: string }
): Promise<GlobalFacets> => {
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return { brands: [], colors: [], availability: getAvailabilityFacet() };
  }
  const cacheKey = `collection:${normalizeHandle(handle) ?? ''}:${options?.country ?? 'GB'}`;
  return unstable_cache(() => fetchCollectionFacets(handle), ['shopify-admin-facets', cacheKey], {
    revalidate: 600,
  })();
};

export const getGlobalFacetsForSearch = async (query: string): Promise<GlobalFacets> => {
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return { brands: [], colors: [], availability: getAvailabilityFacet() };
  }
  const cacheKey = `search:${query.trim().toLowerCase()}`;
  return unstable_cache(() => fetchSearchFacets(query), ['shopify-admin-facets', cacheKey], {
    revalidate: 600,
  })();
};

const fetchAllFacets = async () => {
  const { brandSet, sampleBrandTags } = await scanFacetTags(null, false);
  return {
    brands: brandSet.size ? formatBrandList(brandSet) : [],
    colors: [],
    availability: getAvailabilityFacet(),
    meta: {
      sampleBrandTags,
      scanQuery: null,
      colorMetafieldKey: null,
      rawColorValue: null,
      parsedColors: [],
      colorMetafieldKeysTried: COLOR_KEY_CANDIDATES,
      colorSource: 'none' as const,
    },
  } as GlobalFacets;
};

export const getGlobalFacetsForAll = async (options?: { country?: string }): Promise<GlobalFacets> => {
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return { brands: [], colors: [], availability: getAvailabilityFacet() };
  }
  const cacheKey = `all:${options?.country ?? 'GB'}`;
  return unstable_cache(() => fetchAllFacets(), ['shopify-admin-facets', cacheKey], {
    revalidate: 600,
  })();
};
