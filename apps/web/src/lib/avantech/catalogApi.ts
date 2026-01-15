export type CatalogVariant = {
  id: string;
  productId: string;
  label: string;
  price: number;
  sku?: string | null;
  attributes: Record<string, string | number>;
  isActive: boolean;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  sortOrder: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  variants: CatalogVariant[];
};

export type CatalogCategory = {
  id: string;
  sortOrder: number;
  name: string;
  products: CatalogProduct[];
};

export type CatalogResponse = {
  categories: CatalogCategory[];
};

export type SearchEntry = {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  subtitle: string;
  price: number;
  sku?: string;
  searchText: string;
};

export const indexCatalog = (categories: CatalogCategory[]) => {
  const productsById: Record<string, CatalogProduct> = {};
  const variantsById: Record<string, CatalogVariant> = {};
  const variantsByProductId: Record<string, CatalogVariant[]> = {};

  categories.forEach((category) => {
    category.products.forEach((product) => {
      productsById[product.id] = product;
      variantsByProductId[product.id] = product.variants;
      product.variants.forEach((variant) => {
        variantsById[variant.id] = variant;
      });
    });
  });

  return { productsById, variantsById, variantsByProductId };
};

export const buildSearchEntries = (
  variants: CatalogVariant[],
  productsById: Record<string, CatalogProduct>
): SearchEntry[] =>
  variants.map((variant) => {
    const product = productsById[variant.productId];
    const title = product?.name ?? variant.productId;
    const subtitle = variant.label;
    const sku = variant.sku ?? undefined;
    const searchText = [title, subtitle, sku].filter(Boolean).join(' ').toLowerCase();
    return {
      id: variant.id,
      productId: variant.productId,
      variantId: variant.id,
      title,
      subtitle,
      price: variant.price,
      sku,
      searchText,
    };
  });
