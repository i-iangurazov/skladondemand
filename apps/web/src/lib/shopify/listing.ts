import { deriveFacets, type Facets } from './facets';
import {
  getCollectionProductsPage,
  searchProductsPage,
  type ProductFilters,
  type ProductPage,
} from './storefront';

type ListingMode = 'collection' | 'search' | 'all';

type ListingParams = {
  mode: ListingMode;
  handle?: string;
  query?: string | null;
  after?: string | null;
  before?: string | null;
  first: number;
  last?: number;
  sort?: string | null;
  dir?: string | null;
  filters?: ProductFilters;
  country?: string;
  language?: string;
};

export const fetchListingWithFallback = async (
  params: ListingParams
): Promise<{ page: ProductPage; facets: Facets }> => {
  const page =
    params.mode === 'collection'
      ? await getCollectionProductsPage({
          handle: params.handle as string,
          after: params.after ?? null,
          before: params.before ?? null,
          first: params.first,
          last: params.last,
          sort: params.sort,
          dir: params.dir,
          filters: params.filters,
          country: params.country,
          language: params.language,
        })
      : await searchProductsPage({
          query: params.query ?? null,
          after: params.after ?? null,
          before: params.before ?? null,
          first: params.first,
          last: params.last,
          sort: params.sort,
          dir: params.dir,
          filters: params.filters,
          country: params.country,
          language: params.language,
        });

  const facets = deriveFacets(page.products);

  return { page, facets };
};
