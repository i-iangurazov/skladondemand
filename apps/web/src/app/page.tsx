import Link from 'next/link';
import InfiniteProductGrid from '@/components/store/InfiniteProductGrid';
import BrandChips from '@/components/store/BrandChips';
import HomeReviewsSection from '@/components/store/HomeReviewsSection';
import { Container } from '@/components/layout/Container';
import { getStorefrontContext } from '@/lib/shopify/context';
import { getHomeFeaturedProductsPage } from '@/lib/shopify/storefront';
import { getGlobalFacetsForAll } from '@/lib/shopify/adminFacets';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function Home() {
  const context = await getStorefrontContext();
  const pageSize = 24;
  const [featuredPage, facets] = await Promise.all([
    getHomeFeaturedProductsPage({ first: pageSize, country: context.country, language: context.language }),
    getGlobalFacetsForAll({ country: context.country }),
  ]);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`Fetched ${featuredPage.products.length} products for country=${context.country}`);
  }

  const brands = Array.from(
    new Map(
      (facets.brands ?? [])
        .map((brand) => brand.trim())
        .filter(Boolean)
        .map((brand) => [brand.toLowerCase(), brand])
    ).values()
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 32);

  return (
    <div className="bg-white text-foreground">
      <div className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col gap-10 sm:gap-12">
            <BrandChips brands={brands} className="mt-2 sm:mt-4" />

            <section className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Featured products</h2>
                <Link
                  href="/collections"
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground cursor-pointer"
                >
                  Browse catalog
                </Link>
              </div>
              <InfiniteProductGrid
                initial={featuredPage}
                endpoint={`/api/shopify/featured-products?country=${context.country}&pageSize=${pageSize}&mode=${featuredPage.mode}`}
                priorityCount={4}
              />
            </section>

            <HomeReviewsSection />
          </div>
        </Container>
      </div>
    </div>
  );
}
