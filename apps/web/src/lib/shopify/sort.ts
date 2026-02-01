export type SortKeyParam = 'featured' | 'bestSelling' | 'alpha' | 'price' | 'date';
export type SortDirection = 'asc' | 'desc';

export const parseSortParams = (
  sort: string | null | undefined,
  dir: string | null | undefined
): { sort: SortKeyParam; dir?: SortDirection } => {
  const normalized = (sort ?? 'featured').trim();
  const direction = dir === 'desc' ? 'desc' : dir === 'asc' ? 'asc' : undefined;

  switch (normalized) {
    case 'bestSelling':
      return { sort: 'bestSelling' };
    case 'alpha':
      return { sort: 'alpha', dir: direction ?? 'asc' };
    case 'price':
      return { sort: 'price', dir: direction ?? 'asc' };
    case 'date':
      return { sort: 'date', dir: direction ?? 'desc' };
    case 'alphaAsc':
      return { sort: 'alpha', dir: 'asc' };
    case 'alphaDesc':
      return { sort: 'alpha', dir: 'desc' };
    case 'priceAsc':
      return { sort: 'price', dir: 'asc' };
    case 'priceDesc':
      return { sort: 'price', dir: 'desc' };
    case 'dateNew':
      return { sort: 'date', dir: 'desc' };
    case 'dateOld':
      return { sort: 'date', dir: 'asc' };
    default:
      return { sort: 'featured' };
  }
};

export const sortToShopify = (
  sort: SortKeyParam,
  dir?: SortDirection,
  opts: { mode: 'collection' | 'search' | 'all'; hasQuery?: boolean } = { mode: 'all' }
): { sortKey?: string; reverse?: boolean } => {
  if (sort === 'featured') {
    if (opts.mode === 'search' && opts.hasQuery) {
      return { sortKey: 'RELEVANCE', reverse: false };
    }
    return {};
  }
  if (sort === 'bestSelling') {
    return { sortKey: 'BEST_SELLING', reverse: false };
  }
  if (sort === 'alpha') {
    return { sortKey: 'TITLE', reverse: dir === 'desc' };
  }
  if (sort === 'price') {
    return { sortKey: 'PRICE', reverse: dir === 'desc' };
  }
  if (sort === 'date') {
    if (opts.mode === 'collection') {
      return { sortKey: 'CREATED', reverse: dir !== 'asc' };
    }
    return { sortKey: 'CREATED_AT', reverse: dir !== 'asc' };
  }
  return {};
};
