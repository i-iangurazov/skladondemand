export type LocaleString = { ru: string; en?: string; kg?: string };

export type ImportIssue = {
  level: 'warning' | 'error';
  code: string;
  message: string;
  rowId?: string;
  field?: string;
};

export type ImportRow = {
  id: string;
  category: LocaleString;
  product: {
    ru: string;
    en?: string;
    kg?: string;
    descriptionRu?: string;
    ruOriginal?: string;
    ruBase?: string;
  };
  variant: {
    sku?: string;
    price: number;
    priceRetail?: number;
    priceWholesale?: number | null;
    labelRu?: string;
    attributes?: Record<string, unknown>;
  };
  productKey?: string;
  rowFingerprint?: string;
  targetProductId?: string;
  image?: {
    source: string;
    url?: string;
    sourceId?: string;
    updatedAt?: string;
    quality?: number;
    isUpgraded?: boolean;
  };
  raw?: Record<string, unknown>;
  sortOrder?: number;
  source?: { rowIndex?: number; page?: number; confidence?: number; needsReview?: boolean };
  issues?: ImportIssue[];
};

export type PriceMode = 'retail' | 'wholesale';

export type CsvMapping = {
  categoryRu?: string;
  productRu?: string;
  sku?: string;
  price?: string;
  variantLabelRu?: string;
  descriptionRu?: string;
};

export type CsvParseResult = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  warnings: ImportIssue[];
};

export type ImportParseResult = {
  importId: string;
  rows: ImportRow[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
  checksum: string;
  columns?: string[];
  mapping?: CsvMapping;
  needsReviewCount?: number;
  totalRows?: number;
  sourceType?: 'csv' | 'pdf' | 'cloudshop-xlsx';
};

export type CloudshopPriceStrategy = 'sale' | 'maxLocation';

export type CloudshopCommitOptions = {
  priceStrategy: CloudshopPriceStrategy;
  wholesaleLocation?: string | null;
  skipPriceZero: boolean;
  skipMissingImage: boolean;
};

export type ImportCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  details: Array<{ rowId: string; sku?: string; status: 'created' | 'updated' | 'skipped' | 'failed'; message?: string }>;
  createdEntities?: {
    categories: string[];
    products: string[];
    variants: string[];
  };
};

export type ImportGroupOverride = {
  productId?: string;
  categoryRu?: string;
  labels?: Record<string, string>;
};

export type ImportOverrides = {
  groups: Record<string, ImportGroupOverride>;
};

export type ImportStaging = {
  importId: string;
  checksum: string;
  createdAt: string;
  source: { filename: string; contentType: string };
  rows: ImportRow[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
  csv?: { headers: string[]; delimiter: string; mapping?: CsvMapping };
  priceMode?: PriceMode;
};
