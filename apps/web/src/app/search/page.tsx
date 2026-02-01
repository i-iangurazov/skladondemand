import { Container } from '@/components/layout/Container';
import ProductListingClient from '@/components/store/ProductListingClient';
import { getStorefrontContext } from '@/lib/shopify/context';
import { fetchListingWithFallback } from '@/lib/shopify/listing';
import { deriveCollectionColors } from '@/lib/shopify/facets';
import { getTotalCountForSearch } from '@/lib/shopify/adminCounts';

type SearchParams = { [key: string]: string | string[] | undefined };

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function SearchPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const context = await getStorefrontContext();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : '';
  const brand =
    typeof resolvedSearchParams.brand === 'string' ? resolvedSearchParams.brand : undefined;
  const avail =
    typeof resolvedSearchParams.avail === 'string' ? resolvedSearchParams.avail : undefined;
  const color =
    typeof resolvedSearchParams.color === 'string' ? resolvedSearchParams.color : undefined;
  const sortParam =
    typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : undefined;
  const dirParam =
    typeof resolvedSearchParams.dir === 'string' ? resolvedSearchParams.dir : undefined;
  const pageSize = 24;

  const availability = avail === 'in' || avail === 'out' ? avail : null;
  const { page: initialListing } = await fetchListingWithFallback({
    mode: 'search',
    query: query || null,
    first: pageSize,
    country: context.country,
    language: context.language,
    sort: sortParam ?? null,
    dir: dirParam ?? null,
    filters: {
      brand: brand ?? null,
      availability,
      color: null,
    },
  });
  const initialFacets = deriveCollectionColors(
    { brands: [], colors: [], brandMode: 'tag', colorMode: 'none' },
    []
  );
  const totalCount =
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
      ? await getTotalCountForSearch({
          q: query || null,
          brand: brand ?? null,
          avail: availability,
        })
      : null;

  return (
    <div className="bg-white text-foreground">
      <div className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">Search</h1>
              {query ? (
                <p className="text-sm text-muted-foreground">Results for “{query}”.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Type a query to start searching.</p>
              )}
            </div>
            <ProductListingClient
              mode="search"
              country={context.country}
              query={query}
              initialItems={initialListing.products}
              initialPageInfo={initialListing.pageInfo}
              initialFacets={initialFacets}
              initialTotalCount={totalCount}
            />
          </div>
        </Container>
      </div>
    </div>
  );
}
