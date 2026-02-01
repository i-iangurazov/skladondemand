import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { getStorefrontContext } from '@/lib/shopify/context';
import ProductListingClient from '@/components/store/ProductListingClient';
import { fetchListingWithFallback } from '@/lib/shopify/listing';
import { deriveCollectionColors } from '@/lib/shopify/facets';
import { getCollectionColors, getCollectionInfo } from '@/lib/shopify/storefront';
import { getTotalCountForCollection } from '@/lib/shopify/adminCounts';

type SearchParams = { [key: string]: string | string[] | undefined };

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { handle } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const context = await getStorefrontContext();
  const pageSize = 24;
  const brand =
    typeof resolvedSearchParams.brand === 'string' ? resolvedSearchParams.brand : undefined;
  const avail = typeof resolvedSearchParams.avail === 'string' ? resolvedSearchParams.avail : undefined;
  const color = typeof resolvedSearchParams.color === 'string' ? resolvedSearchParams.color : undefined;
  const sortParam =
    typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : undefined;
  const dirParam =
    typeof resolvedSearchParams.dir === 'string' ? resolvedSearchParams.dir : undefined;

  const collection = await getCollectionInfo(handle, context);

  if (!collection) {
    notFound();
  }

  const availability = avail === 'in' || avail === 'out' ? avail : null;
  const { page: initialListing } = await fetchListingWithFallback({
    mode: 'collection',
    handle,
    first: pageSize,
    country: context.country,
    language: context.language,
    sort: sortParam ?? null,
    dir: dirParam ?? null,
    filters: {
      brand: brand ?? null,
      availability,
      color: color ?? null,
    },
  });
  const collectionColors = await getCollectionColors(handle, context);
  const initialFacets = deriveCollectionColors(
    { brands: [], colors: [], brandMode: 'tag', colorMode: 'none' },
    collectionColors
  );
  const totalCount =
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
      ? await getTotalCountForCollection({
          handle,
          q: null,
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
              <h1 className="text-2xl font-semibold">{collection.title}</h1>
              {collection.description && (
                <p className="text-sm text-muted-foreground">{collection.description}</p>
              )}
            </div>
            <ProductListingClient
              mode="collection"
              handle={handle}
              country={context.country}
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
