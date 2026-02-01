import { z } from 'zod';

export const moneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

export type Money = z.infer<typeof moneySchema>;

export const imageSchema = z
  .object({
    url: z.string(),
    altText: z.string().nullable().optional(),
  })
  .nullable();

export type Image = z.infer<typeof imageSchema>;

export const collectionSummarySchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  image: imageSchema.optional(),
});

export type CollectionSummary = z.infer<typeof collectionSummarySchema>;

export const productOptionSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
});

export const productSummarySchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  featuredImage: imageSchema.optional(),
  priceRange: z.object({
    minVariantPrice: moneySchema,
    maxVariantPrice: moneySchema,
  }),
  vendor: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(productOptionSchema).optional(),
});

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  availableForSale: boolean;
  featuredImage?: Image | null;
  priceRange: {
    min: Money;
    max: Money;
  };
  vendor?: string | null;
  tags?: string[];
  options?: z.infer<typeof productOptionSchema>[];
};

export const productVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  selectedOptions: z.array(z.object({ name: z.string(), value: z.string() })),
  price: moneySchema,
  compareAtPrice: moneySchema.nullable().optional(),
});

export const productDetailSchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  descriptionHtml: z.string().nullable().optional(),
  featuredImage: imageSchema.optional(),
  images: z.object({ nodes: z.array(imageSchema) }).optional(),
  options: z.array(productOptionSchema),
  variants: z.object({ nodes: z.array(productVariantSchema) }),
  tags: z.array(z.string()).optional(),
  vendor: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;

export type ProductDetail = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml?: string | null;
  featuredImage?: Image | null;
  images: Array<Image | null>;
  options: z.infer<typeof productOptionSchema>[];
  variants: ProductVariant[];
  tags: string[];
  vendor?: string | null;
  productType?: string | null;
};

export const mapProductSummary = (input: z.infer<typeof productSummarySchema>): ProductSummary => ({
  id: input.id,
  handle: input.handle,
  title: input.title,
  availableForSale: input.availableForSale,
  featuredImage: input.featuredImage ?? null,
  priceRange: {
    min: input.priceRange.minVariantPrice,
    max: input.priceRange.maxVariantPrice,
  },
  vendor: input.vendor ?? null,
  tags: input.tags ?? [],
  options: input.options ?? [],
});

export const mapProductDetail = (input: z.infer<typeof productDetailSchema>): ProductDetail => ({
  id: input.id,
  handle: input.handle,
  title: input.title,
  descriptionHtml: input.descriptionHtml ?? null,
  featuredImage: input.featuredImage ?? null,
  images:
    input.images?.nodes?.length
      ? input.images.nodes
      : input.featuredImage
        ? [input.featuredImage]
        : [],
  options: input.options,
  variants: input.variants.nodes,
  tags: input.tags ?? [],
  vendor: input.vendor ?? null,
  productType: input.productType ?? null,
});
