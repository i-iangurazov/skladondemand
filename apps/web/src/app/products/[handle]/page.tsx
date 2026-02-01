import { notFound } from 'next/navigation';
import ProductForm from '@/components/store/ProductForm';
import ProductGallery from '@/components/store/ProductGallery';
import ProductReviewsSection from '@/components/store/ProductReviewsSection';
import FavoriteButton from '@/components/store/FavoriteButton';
import { Container } from '@/components/layout/Container';
import { getStorefrontContext } from '@/lib/shopify/context';
import { getProductByHandle } from '@/lib/shopify/storefront';

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const context = await getStorefrontContext();
  const start = Date.now();
  const product = await getProductByHandle(handle, context);
  if (process.env.NODE_ENV !== 'production') {
    console.info(`Product fetch ${handle} took ${Date.now() - start}ms`);
  }

  if (!product) {
    notFound();
  }

  const findTagValue = (prefix: string) => {
    const match = product.tags.find((tag) => tag.toLowerCase().startsWith(prefix));
    return match ? match.split(':').slice(1).join(':').trim() : null;
  };
  const material = findTagValue('material:');
  const fit = findTagValue('fit:');
  const care = findTagValue('care:');
  return (
    <div className="bg-white text-foreground">
      <div className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col gap-10">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <ProductGallery images={product.images} />

              <div className="flex flex-col gap-6 sm:gap-8">
                <div className="flex flex-col gap-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">skladondemand</p>
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-[20px] font-semibold sm:text-[22px]">{product.title}</h1>
                    <FavoriteButton productHandle={product.handle} />
                  </div>
                </div>

                <ProductForm product={product} />

                {product.descriptionHtml ? (
                  <div className="border-t border-border pt-6">
                    <div
                      className="text-sm leading-6 text-foreground [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5"
                      dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                    />
                  </div>
                ) : null}

                <div className="border-t border-border pt-6 text-sm text-muted-foreground">
                  {material ? <p>Material: {material}</p> : null}
                  {fit ? <p>Fit: {fit}</p> : null}
                  {care ? <p>Care: {care}</p> : null}
                  {product.productType ? <p>Type: {product.productType}</p> : null}
                  {product.vendor ? <p>Vendor: {product.vendor}</p> : null}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-8">
              <ProductReviewsSection productHandle={product.handle} />
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}
