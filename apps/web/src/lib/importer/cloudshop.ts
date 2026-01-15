import { createHash } from 'crypto';
import * as XLSX from 'xlsx';
import { normalizeWhitespace, safeString } from './normalize';
import { parsePriceToInt } from './price';
import { buildProductKey, buildRowFingerprint, extractVariantAttributes } from './variant';
import type { CloudshopPriceStrategy, ImportIssue, ImportRow } from './types';

const CLOUDSHOP_SHEET_NAMES = ['sheet 1', 'sheet1'];
const HEADER_QUOTES = /[«»"]/g;
const MIN_SKU_LENGTH = 4;
const MAX_FILE_ROWS = 100000;
const IMAGE_LOW_QUALITY_THRESHOLD = 0.45;

const HEADERS = {
  name: 'Наименование',
  type: 'Тип',
  code: 'Код товара',
  barcode: 'Штрих-код',
  article: 'Артикул',
  description: 'Описание',
  categories: 'Категории',
  expiry: 'Срок годности',
  image: 'Изображение',
  priceRetail: 'Цена продажи',
  pricePurchase: 'Цена закупки',
  discount: 'Скидка',
  cost: 'Себестоимость',
  minStock: 'Минимальный остаток',
  unit: 'Единица измерения',
  weighted: 'Весовой товар',
  freePrice: 'Товар по свободной цене',
  supplier: 'Поставщик',
  country: 'Страна',
  taxes: 'Налоги',
  taxExempt: 'Не облагается налогом',
  stockTotal: 'Общий остаток',
};

const ISSUE_CODES = {
  nameMissing: 'NAME_MISSING',
  categoryMissing: 'CATEGORY_MISSING',
  skuGenerated: 'SKU_GENERATED',
  priceZero: 'PRICE_ZERO',
  imageMissing: 'IMAGE_MISSING',
  imageLowQuality: 'IMAGE_LOW_QUALITY',
  headersMissing: 'HEADERS_MISSING',
};

type LocationColumn = { header: string; location: string };

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  а: 'A',
  в: 'B',
  е: 'E',
  к: 'K',
  м: 'M',
  н: 'H',
  о: 'O',
  р: 'P',
  с: 'C',
  т: 'T',
  х: 'X',
  у: 'Y',
};

const buildIssue = (
  level: 'warning' | 'error',
  code: string,
  message: string,
  rowId?: string,
  field?: string
): ImportIssue => ({
  level,
  code,
  message,
  rowId,
  field,
});

const normalizeCloudshopHeaderLabel = (value: string) =>
  normalizeWhitespace(value).replace(HEADER_QUOTES, '');

const normalizeCloudshopHeaderKey = (value: string) =>
  normalizeCloudshopHeaderLabel(value).toLowerCase();

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = safeString(value).replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePriceValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const parsed = parsePriceToInt(safeString(value));
  return parsed.value ?? 0;
};

const parseYesNo = (value: unknown) => {
  const normalized = safeString(value);
  if (!normalized) return null;
  return normalized.toUpperCase() === 'YES';
};

const parseLocationHeader = (header: string, prefix: string) => {
  const normalized = normalizeCloudshopHeaderLabel(header);
  if (!normalized.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const raw = normalized.slice(prefix.length).trim();
  return raw.replace(HEADER_QUOTES, '').trim();
};

export const extractLocationColumns = (headers: string[]) => {
  const priceColumns: LocationColumn[] = [];
  const stockColumns: LocationColumn[] = [];

  headers.forEach((header) => {
    const priceLocation = parseLocationHeader(header, 'Цена в');
    if (priceLocation) {
      priceColumns.push({ header, location: priceLocation });
      return;
    }

    const stockLocation = parseLocationHeader(header, 'Остаток в');
    if (stockLocation) {
      stockColumns.push({ header, location: stockLocation });
    }
  });

  return { priceColumns, stockColumns };
};

export const extractLocationPricesFromRaw = (raw: Record<string, unknown>) => {
  const prices: Record<string, number> = {};
  Object.entries(raw).forEach(([header, value]) => {
    const location = parseLocationHeader(header, 'Цена в');
    if (!location) return;
    const parsed = parseNumeric(value);
    if (parsed !== null && parsed > 0) {
      prices[location] = Math.round(parsed);
    }
  });
  return prices;
};

const extractLocationStocksFromRaw = (raw: Record<string, unknown>) => {
  const stocks: Record<string, number> = {};
  Object.entries(raw).forEach(([header, value]) => {
    const location = parseLocationHeader(header, 'Остаток в');
    if (!location) return;
    const parsed = parseNumeric(value);
    if (parsed !== null) {
      stocks[location] = parsed;
    }
  });
  return stocks;
};

const extractPriceCandidates = (raw: Record<string, unknown>) => {
  const priceSale = parsePriceValue(raw[HEADERS.priceRetail]);
  const pricesByLocation = extractLocationPricesFromRaw(raw);
  const maxLocation = Object.values(pricesByLocation).reduce((max, value) => (value > max ? value : max), 0);
  return { priceSale, maxLocation, pricesByLocation };
};

export const resolveCloudshopRetailPrice = (raw: Record<string, unknown>, strategy: CloudshopPriceStrategy) => {
  const { priceSale, maxLocation } = extractPriceCandidates(raw);
  if (strategy === 'maxLocation') {
    if (maxLocation > 0) return maxLocation;
    return priceSale > 0 ? priceSale : 0;
  }
  if (priceSale > 0) return priceSale;
  return maxLocation > 0 ? maxLocation : 0;
};

export const resolveCloudshopWholesalePrice = (
  raw: Record<string, unknown>,
  location?: string | null
) => {
  if (!location) return null;
  const pricesByLocation = extractLocationPricesFromRaw(raw);
  const value = pricesByLocation[location];
  return typeof value === 'number' ? value : null;
};

export const normalizeCloudshopSku = (value: string) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return '';
  const noSpaces = trimmed.replace(/\s+/g, '').toUpperCase();
  let mapped = '';
  for (const char of noSpaces) {
    mapped += CYRILLIC_LOOKALIKES[char] ?? char;
  }
  const sanitized = mapped.replace(/[^A-Z0-9-_]/g, '');
  if (sanitized.length < MIN_SKU_LENGTH) return '';
  return sanitized;
};

export const resolveCloudshopSku = (params: {
  article?: unknown;
  barcode?: unknown;
  code?: unknown;
  name?: string;
  category?: string;
  unit?: string;
}) => {
  const candidates = [safeString(params.article), safeString(params.barcode), safeString(params.code)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeCloudshopSku(candidate);
    if (normalized) return { sku: normalized, generated: false };
  }

  const seed = [params.name ?? '', params.category ?? '', safeString(params.barcode), params.unit ?? '']
    .map((value) => normalizeWhitespace(value).toLowerCase())
    .join('|');
  const hash = createHash('sha1').update(seed).digest('hex').toUpperCase();
  return { sku: `GEN-${hash}`, generated: true };
};

export const deriveCloudshopLabel = (name: string) => {
  const extracted = extractVariantAttributes(name);
  return {
    label: extracted.labelRu || undefined,
    attributes: extracted.attrs,
  };
};

export const parseCloudshopCategories = (value: unknown) => {
  const normalized = safeString(value);
  if (!normalized) {
    return { primary: 'Без категории', all: [] as string[], needsReview: true };
  }

  const parts = normalized
    .split(/[;,|/]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (!parts.length) {
    return { primary: 'Без категории', all: [] as string[], needsReview: true };
  }

  return {
    primary: parts[0],
    all: Array.from(new Set(parts)),
    needsReview: false,
  };
};

const buildRawRecord = (headers: string[], row: unknown[]) => {
  const record: Record<string, unknown> = {};
  headers.forEach((header, idx) => {
    record[header] = row[idx];
  });
  return record;
};

const buildHeaderIndex = (headers: string[]) => {
  const index = new Map<string, { header: string; idx: number }>();
  headers.forEach((header, idx) => {
    index.set(normalizeCloudshopHeaderKey(header), { header, idx });
  });
  return index;
};

const getCell = (row: unknown[], index: Map<string, { header: string; idx: number }>, header: string) => {
  const resolved = index.get(normalizeCloudshopHeaderKey(header));
  if (!resolved) return undefined;
  return row[resolved.idx];
};

const extractFirstUrl = (value: string) => {
  const matches = value.match(/https?:\/\/[^\s,;]+/gi);
  return matches?.[0];
};

const estimateImageQuality = (url: string) => {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const candidates = ['w', 'width', 'h', 'height', 'size', 'max', 'maxWidth', 'maxHeight'];
    let maxDimension = 0;
    candidates.forEach((key) => {
      const value = params.get(key);
      if (!value) return;
      const parsedValue = Number.parseInt(value, 10);
      if (Number.isFinite(parsedValue)) {
        maxDimension = Math.max(maxDimension, parsedValue);
      }
    });

    let score = 0.6;
    if (maxDimension >= 1200) score = 1;
    else if (maxDimension >= 800) score = 0.85;
    else if (maxDimension >= 500) score = 0.7;
    else if (maxDimension > 0) score = 0.4;

    const path = parsed.pathname.toLowerCase();
    if (/(thumb|thumbnail|small|preview|mini|icon)/.test(path)) {
      score -= 0.2;
    }
    if (/(original|large|full|xl|hd)/.test(path)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
};

const upgradeImageUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    let upgraded = false;
    ['w', 'width', 'h', 'height', 'size', 'max', 'maxWidth', 'maxHeight'].forEach((key) => {
      const value = params.get(key);
      if (!value) return;
      const parsedValue = Number.parseInt(value, 10);
      if (Number.isFinite(parsedValue) && parsedValue < 1200) {
        params.set(key, '1200');
        upgraded = true;
      }
    });
    if (upgraded) {
      parsed.search = params.toString();
      return { url: parsed.toString(), upgraded: true };
    }
  } catch {
    return { url, upgraded: false };
  }
  return { url, upgraded: false };
};

const validateHeaders = (headers: string[]) => {
  const errors: ImportIssue[] = [];
  const normalized = headers.map(normalizeCloudshopHeaderKey);
  const hasName = normalized.includes(normalizeCloudshopHeaderKey(HEADERS.name));
  const hasPriceRetail = normalized.includes(normalizeCloudshopHeaderKey(HEADERS.priceRetail));
  const { priceColumns } = extractLocationColumns(headers);

  if (!hasName) {
    errors.push(buildIssue('error', ISSUE_CODES.headersMissing, 'Missing header: Наименование', undefined, 'name'));
  }

  if (!hasPriceRetail && priceColumns.length === 0) {
    errors.push(
      buildIssue(
        'error',
        ISSUE_CODES.headersMissing,
        'Missing price header: Цена продажи or any Цена в «…» column',
        undefined,
        'priceRetail'
      )
    );
  }

  return { errors, hasName, hasPriceRetail };
};

export const normalizeCloudshopRows = (params: {
  headers: string[];
  rows: unknown[][];
  priceStrategy?: CloudshopPriceStrategy;
}): { rows: ImportRow[]; warnings: ImportIssue[]; errors: ImportIssue[] } => {
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];
  const normalizedRows: ImportRow[] = [];
  const priceStrategy = params.priceStrategy ?? 'sale';

  const headerValidation = validateHeaders(params.headers);
  if (headerValidation.errors.length) {
    errors.push(...headerValidation.errors);
    return { rows: [], warnings, errors };
  }

  const headerIndex = buildHeaderIndex(params.headers);

  params.rows.slice(0, MAX_FILE_ROWS).forEach((row, idx) => {
    const hasContent = row.some((cell) => safeString(cell) !== '');
    if (!hasContent) {
      return;
    }

    const rowIndex = idx + 2;
    const rowId = `cloudshop-${rowIndex}`;
    const issues: ImportIssue[] = [];

    const nameValue = safeString(getCell(row, headerIndex, HEADERS.name));
    if (!nameValue) {
      issues.push(buildIssue('error', ISSUE_CODES.nameMissing, 'Product name is required.', rowId, 'name'));
    }

    const description = safeString(getCell(row, headerIndex, HEADERS.description));
    const unit = safeString(getCell(row, headerIndex, HEADERS.unit));
    const categoriesValue = getCell(row, headerIndex, HEADERS.categories);
    const categoryParsed = parseCloudshopCategories(categoriesValue);
    if (categoryParsed.needsReview) {
      issues.push(buildIssue('warning', ISSUE_CODES.categoryMissing, 'Category is missing.', rowId, 'category'));
    }

    const raw = buildRawRecord(params.headers, row);
    const priceRetail = resolveCloudshopRetailPrice(raw, priceStrategy);
    if (priceRetail <= 0) {
      issues.push(buildIssue('warning', ISSUE_CODES.priceZero, 'Price is missing or zero.', rowId, 'priceRetail'));
    }

    const skuResult = resolveCloudshopSku({
      article: getCell(row, headerIndex, HEADERS.article),
      barcode: getCell(row, headerIndex, HEADERS.barcode),
      code: getCell(row, headerIndex, HEADERS.code),
      name: nameValue,
      category: categoryParsed.primary,
      unit,
    });

    if (skuResult.generated) {
      issues.push(buildIssue('warning', ISSUE_CODES.skuGenerated, 'Missing SKU, generated a fallback.', rowId, 'sku'));
    }

    const variantExtraction = extractVariantAttributes(nameValue);
    const pricesByLocation = extractLocationPricesFromRaw(raw);
    const stockByLocation = extractLocationStocksFromRaw(raw);

    const attributes = buildCloudshopAttributes({
      row: raw,
      categories: categoryParsed.all,
      pricesByLocation,
      stockByLocation,
      labelAttributes: variantExtraction.attrs,
    });

    const imageRaw = safeString(getCell(row, headerIndex, HEADERS.image));
    const firstUrl = imageRaw ? extractFirstUrl(imageRaw) : undefined;
    const upgraded = firstUrl ? upgradeImageUrl(firstUrl) : { url: firstUrl ?? '', upgraded: false };
    const imageUrl = upgraded.url || undefined;
    const imageQuality = imageUrl ? estimateImageQuality(imageUrl) : undefined;

    if (!imageUrl) {
      issues.push(buildIssue('warning', ISSUE_CODES.imageMissing, 'Image is missing.', rowId, 'image'));
    } else if ((imageQuality ?? 1) < IMAGE_LOW_QUALITY_THRESHOLD) {
      issues.push(buildIssue('warning', ISSUE_CODES.imageLowQuality, 'Image looks low quality.', rowId, 'image'));
    }

    const baseName = variantExtraction.baseNameRu || nameValue || 'Без названия';
    const productKey = buildProductKey(categoryParsed.primary || 'Без категории', baseName);
    const rowFingerprint = buildRowFingerprint({
      productKey,
      labelRu: variantExtraction.labelRu,
      priceRetail,
      unit,
    });

    const needsReview =
      skuResult.generated ||
      priceRetail <= 0 ||
      categoryParsed.needsReview ||
      !imageUrl ||
      (imageQuality ?? 1) < IMAGE_LOW_QUALITY_THRESHOLD ||
      !nameValue;

    let confidence = 0.95;
    if (!nameValue) confidence = 0.1;
    else if (categoryParsed.needsReview) confidence = 0.5;
    else if (skuResult.generated || priceRetail <= 0) confidence = 0.75;

    normalizedRows.push({
      id: rowId,
      category: { ru: categoryParsed.primary },
      product: {
        ru: baseName,
        ruOriginal: nameValue || 'Без названия',
        ruBase: baseName,
        descriptionRu: description || undefined,
      },
      variant: {
        sku: skuResult.sku,
        price: priceRetail,
        priceRetail,
        priceWholesale: null,
        labelRu: variantExtraction.labelRu || undefined,
        attributes,
      },
      productKey,
      rowFingerprint,
      image: imageUrl
        ? {
            source: 'cloudshop',
            url: imageUrl,
            sourceId: extractImageSourceId(imageUrl),
            updatedAt: new Date().toISOString(),
            quality: imageQuality,
            isUpgraded: upgraded.upgraded,
          }
        : undefined,
      raw,
      source: {
        rowIndex,
        confidence,
        needsReview,
      },
      issues: issues.length ? issues : undefined,
    });
  });

  if (!normalizedRows.length) {
    warnings.push(buildIssue('warning', 'cloudshop.noRows', 'No rows detected in CloudShop sheet.'));
  }

  return { rows: normalizedRows, warnings, errors };
};

export const buildCloudshopAttributes = (params: {
  row: Record<string, unknown>;
  categories?: string[];
  pricesByLocation: Record<string, number>;
  stockByLocation: Record<string, number>;
  labelAttributes?: Record<string, unknown>;
}) => {
  const { row, categories, pricesByLocation, stockByLocation, labelAttributes } = params;
  const attributes: Record<string, unknown> = {};

  const type = safeString(row[HEADERS.type]);
  if (type) attributes.type = type;

  const unit = safeString(row[HEADERS.unit]);
  if (unit) attributes.unit = unit;

  const code = safeString(row[HEADERS.code]);
  if (code) attributes.code = code;

  const barcode = safeString(row[HEADERS.barcode]);
  if (barcode) attributes.barcode = barcode;

  const article = safeString(row[HEADERS.article]);
  if (article) attributes.article = article;

  const minStock = parseNumeric(row[HEADERS.minStock]);
  if (minStock !== null) attributes.minStock = minStock;

  const isWeighted = parseYesNo(row[HEADERS.weighted]);
  if (isWeighted !== null) attributes.isWeighted = isWeighted;

  const freePrice = parseYesNo(row[HEADERS.freePrice]);
  if (freePrice !== null) attributes.freePrice = freePrice;

  const supplier = safeString(row[HEADERS.supplier]);
  if (supplier) attributes.supplier = supplier;

  const country = safeString(row[HEADERS.country]);
  if (country) attributes.country = country;

  const taxes = safeString(row[HEADERS.taxes]);
  if (taxes) attributes.taxes = taxes;

  const taxExempt = parseYesNo(row[HEADERS.taxExempt]);
  if (taxExempt !== null) attributes.taxExempt = taxExempt;

  const expiry = safeString(row[HEADERS.expiry]);
  if (expiry) attributes.expiry = expiry;

  const discount = parseNumeric(row[HEADERS.discount]);
  if (discount !== null) attributes.discount = discount;

  const purchasePrice = parseNumeric(row[HEADERS.pricePurchase]);
  if (purchasePrice !== null) attributes.costPrice = purchasePrice;

  const costValue = parseNumeric(row[HEADERS.cost]);
  if (costValue !== null) attributes.costValue = costValue;

  const stockTotal = parseNumeric(row[HEADERS.stockTotal]);
  if (stockTotal !== null) attributes.stockTotal = stockTotal;

  if (categories && categories.length > 1) {
    attributes.categories = categories;
  }

  if (Object.keys(stockByLocation).length) attributes.stockByLocation = stockByLocation;
  if (Object.keys(pricesByLocation).length) attributes.pricesByLocation = pricesByLocation;

  if (labelAttributes) {
    Object.entries(labelAttributes).forEach(([key, value]) => {
      if (value !== undefined) attributes[key] = value;
    });
  }

  return attributes;
};

export const parseCloudshopWorkbook = (buffer: Buffer) => {
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (error) {
    console.error(error);
    errors.push(buildIssue('error', 'cloudshop.parse.failed', 'Failed to parse Excel file.'));
    return { rows: [], warnings, errors, columns: [] as string[] };
  }

  const sheetName =
    workbook.SheetNames.find((name) => CLOUDSHOP_SHEET_NAMES.includes(name.trim().toLowerCase())) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    errors.push(buildIssue('error', 'cloudshop.sheet.missing', 'No sheets found in Excel file.'));
    return { rows: [], warnings, errors, columns: [] as string[] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  if (!rawRows.length) {
    warnings.push(buildIssue('warning', 'cloudshop.empty', 'Excel sheet is empty.'));
    return { rows: [], warnings, errors, columns: [] as string[] };
  }

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((value, idx) => {
    const text = safeString(value);
    return text || `column_${idx + 1}`;
  });

  if (!dataRows.length) {
    warnings.push(buildIssue('warning', 'cloudshop.emptyRows', 'Excel sheet contains headers only.'));
  }

  const normalized = normalizeCloudshopRows({ headers, rows: dataRows });
  return {
    rows: normalized.rows,
    warnings: [...warnings, ...normalized.warnings],
    errors: [...errors, ...normalized.errors],
    columns: headers,
  };
};

const extractImageSourceId = (url: string) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] ?? '';
    const withoutQuery = last.split('?')[0];
    const trimmed = withoutQuery.replace(/\.[a-z0-9]+$/i, '');
    return trimmed || undefined;
  } catch {
    return undefined;
  }
};
