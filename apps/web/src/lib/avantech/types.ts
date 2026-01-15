export type Language = 'en' | 'ru' | 'kg';

export type LocalizedText = {
  en: string;
  ru?: string;
  kg?: string;
};

export type Category = {
  id: string;
  name: LocalizedText;
  sortOrder: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: LocalizedText;
  imageUrl?: string;
  description?: LocalizedText;
  baseUnit?: string;
};

export type Variant = {
  id: string;
  productId: string;
  label: LocalizedText;
  attributes: Record<string, string | number>;
  price: number;
  sku?: string;
  isActive: boolean;
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
