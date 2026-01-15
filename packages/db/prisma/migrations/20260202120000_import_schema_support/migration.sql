-- Add pricing fields and catalog metadata for import support
ALTER TABLE "Variant" ADD COLUMN "priceRetail" INTEGER;
ALTER TABLE "Variant" ADD COLUMN "priceWholesale" INTEGER;

UPDATE "Variant" SET "priceRetail" = "price" WHERE "priceRetail" IS NULL;

ALTER TABLE "Variant" ALTER COLUMN "priceRetail" SET NOT NULL;

ALTER TABLE "Category" ADD COLUMN "slug" TEXT;
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "imageSource" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageSourceId" TEXT;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Variant_priceRetail_idx" ON "Variant"("priceRetail");
CREATE INDEX "Variant_priceWholesale_idx" ON "Variant"("priceWholesale");
CREATE INDEX "Variant_attributes_idx" ON "Variant" USING GIN ("attributes");
