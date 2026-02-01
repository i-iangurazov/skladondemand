-- Add pricing fields and catalog metadata for import support
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Variant' AND relkind = 'r') THEN
    ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "priceRetail" INTEGER;
    ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "priceWholesale" INTEGER;

    UPDATE "Variant" SET "priceRetail" = "price" WHERE "priceRetail" IS NULL;

    ALTER TABLE "Variant" ALTER COLUMN "priceRetail" SET NOT NULL;

    CREATE INDEX IF NOT EXISTS "Variant_priceRetail_idx" ON "Variant"("priceRetail");
    CREATE INDEX IF NOT EXISTS "Variant_priceWholesale_idx" ON "Variant"("priceWholesale");
    CREATE INDEX IF NOT EXISTS "Variant_attributes_idx" ON "Variant" USING GIN ("attributes");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Category' AND relkind = 'r') THEN
    ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "slug" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Product' AND relkind = 'r') THEN
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "slug" TEXT;
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUpdatedAt" TIMESTAMP(3);
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageSource" TEXT;
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageSourceId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug");
  END IF;
END $$;
