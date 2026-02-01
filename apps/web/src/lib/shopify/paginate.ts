import { shopifyFetch } from './client';

type PageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

type Connection<TNode> = {
  nodes: TNode[];
  pageInfo: PageInfo;
};

export type PageInfoTrace = {
  page: number;
  count: number;
  hasNextPage: boolean;
  endCursor: string | null;
};

export type ShopifyPaginateOptions<TData, TNode> = {
  query: string;
  variables?: Record<string, unknown>;
  getConnection: (data: TData) => Connection<TNode> | null | undefined;
  country?: string;
  language?: string;
  pageSize?: number;
  maxPages?: number;
  cache?: RequestCache;
  revalidate?: number;
  tags?: string[];
};

const MAX_PAGE_SIZE = 250;
const DEFAULT_MAX_PAGES = 50;

export async function shopifyPaginate<TData, TNode>(
  options: ShopifyPaginateOptions<TData, TNode>
): Promise<{ nodes: TNode[]; pageInfoTrace: PageInfoTrace[] }> {
  const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const nodes: TNode[] = [];
  const pageInfoTrace: PageInfoTrace[] = [];

  let cursor: string | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await shopifyFetch<TData>(options.query, {
      variables: {
        ...(options.variables ?? {}),
        first: pageSize,
        after: cursor,
      },
      country: options.country,
      language: options.language,
      cache: options.cache,
      revalidate: options.revalidate,
      tags: options.tags,
    });

    const connection = options.getConnection(data);
    const pageNodes = connection?.nodes ?? [];
    const pageInfo = connection?.pageInfo ?? { hasNextPage: false, endCursor: null };

    nodes.push(...pageNodes);
    pageInfoTrace.push({
      page,
      count: pageNodes.length,
      hasNextPage: Boolean(pageInfo.hasNextPage),
      endCursor: pageInfo.endCursor ?? null,
    });

    if (!pageInfo.hasNextPage) {
      return { nodes, pageInfoTrace };
    }

    if (!pageInfo.endCursor) {
      throw new Error('Shopify pagination error: missing endCursor for next page.');
    }

    cursor = pageInfo.endCursor;
  }

  throw new Error(`Shopify pagination exceeded ${maxPages} pages. Increase limitPages if needed.`);
}
