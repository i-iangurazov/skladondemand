import { coerceAttributeValue, normalizeHeader, normalizeWhitespace, safeString } from './normalize';
import { parsePriceToInt } from './price';
import { generateStableSku, normalizeSku } from './sku';
import { buildProductKey, buildRowFingerprint, extractVariantAttributes } from './variant';
import type { CsvMapping, CsvParseResult, ImportIssue, ImportRow, PriceMode } from './types';

const DELIMITERS = [',', ';', '\t'];

const buildIssue = (level: 'warning' | 'error', code: string, message: string, rowId?: string): ImportIssue => ({
  level,
  code,
  message,
  rowId,
});

export const detectDelimiter = (content: string) => {
  const sampleLines = content.split(/\r?\n/).slice(0, 10);
  const scores = DELIMITERS.map((delimiter) => {
    let total = 0;
    for (const line of sampleLines) {
      total += line.split(delimiter).length - 1;
    }
    return total;
  });
  const max = Math.max(...scores);
  const idx = scores.findIndex((score) => score === max);
  return DELIMITERS[idx] ?? ',';
};

export const parseCsvContent = (content: string, delimiter?: string): CsvParseResult => {
  const normalizedContent = content.replace(/^\uFEFF/, '');
  const resolvedDelimiter = delimiter ?? detectDelimiter(normalizedContent);
  const rows: string[][] = [];
  const warnings: ImportIssue[] = [];

  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(safeString(current));
    current = '';
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < normalizedContent.length; i += 1) {
    const char = normalizedContent[i];
    const next = normalizedContent[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === resolvedDelimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushCell();
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], delimiter: resolvedDelimiter, warnings };
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header, idx) => {
    const normalized = normalizeWhitespace(header);
    if (!normalized) return `column_${idx + 1}`;
    return normalized;
  });

  if (dataRows.length === 0) {
    warnings.push(buildIssue('warning', 'csv.empty', 'CSV contains only headers.'));
  }

  return { headers, rows: dataRows, delimiter: resolvedDelimiter, warnings };
};

const matchHeader = (headers: string[], patterns: string[]) => {
  const normalized = headers.map((header) => normalizeHeader(header));
  for (const pattern of patterns) {
    const idx = normalized.findIndex((header) => header.includes(pattern));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
};

export const suggestCsvMapping = (headers: string[], priceMode: PriceMode = 'retail'): CsvMapping => {
  const mapping: CsvMapping = {
    categoryRu: matchHeader(headers, ['category_ru', 'category', 'катег', 'группа', 'раздел']),
    productRu: matchHeader(headers, ['product_ru', 'product', 'товар', 'наименован', 'назван', 'item', 'позиция']),
    sku: matchHeader(headers, ['sku', 'артикул', 'код', 'id', 'арт']),
    variantLabelRu: matchHeader(headers, ['variant_label_ru', 'label', 'variant', 'вариант', 'размер', 'тип', 'модель']),
    descriptionRu: matchHeader(headers, ['description_ru', 'description', 'описани', 'desc']),
  };

  const retail = matchHeader(headers, ['retail', 'розниц', 'price', 'цена', 'стоим']);
  const wholesale = matchHeader(headers, ['wholesale', 'опт', 'оптов']);

  if (priceMode === 'wholesale' && wholesale) {
    mapping.price = wholesale;
  } else if (retail) {
    mapping.price = retail;
  } else {
    mapping.price = wholesale;
  }

  return mapping;
};

export const normalizeCsvRows = (params: {
  headers: string[];
  rows: string[][];
  mapping: CsvMapping;
}): { rows: ImportRow[]; warnings: ImportIssue[]; errors: ImportIssue[] } => {
  const { headers, rows, mapping } = params;
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];
  const normalizedRows: ImportRow[] = [];

  const headerLookup = new Map(headers.map((header, idx) => [normalizeHeader(header), idx]));

  const resolveIndex = (header?: string) => {
    if (!header) return null;
    const idx = headerLookup.get(normalizeHeader(header));
    return typeof idx === 'number' ? idx : null;
  };

  const idxCategory = resolveIndex(mapping.categoryRu);
  const idxProduct = resolveIndex(mapping.productRu);
  const idxSku = resolveIndex(mapping.sku);
  const idxPrice = resolveIndex(mapping.price);
  const idxLabel = resolveIndex(mapping.variantLabelRu);
  const idxDescription = resolveIndex(mapping.descriptionRu);

  if (idxCategory === null) {
    errors.push(buildIssue('error', 'csv.mapping.category_ru', 'Category column is required.'));
  }
  if (idxProduct === null) {
    errors.push(buildIssue('error', 'csv.mapping.product_ru', 'Product column is required.'));
  }
  if (idxPrice === null) {
    errors.push(buildIssue('error', 'csv.mapping.price', 'Price column is required.'));
  }

  const mappedIndices = new Set([idxCategory, idxProduct, idxSku, idxPrice, idxLabel, idxDescription].filter(
    (idx): idx is number => typeof idx === 'number'
  ));

  rows.forEach((row, index) => {
    const rowId = `csv-${index + 1}`;
    const issues: ImportIssue[] = [];

    const categoryName = idxCategory === null ? '' : safeString(row[idxCategory]);
    const productName = idxProduct === null ? '' : safeString(row[idxProduct]);
    const skuValue = idxSku === null ? '' : safeString(row[idxSku]);
    const priceValue = idxPrice === null ? '' : safeString(row[idxPrice]);
    const labelValue = idxLabel === null ? '' : safeString(row[idxLabel]);
    const descriptionValue = idxDescription === null ? '' : safeString(row[idxDescription]);

    if (!categoryName) {
      issues.push(buildIssue('error', 'row.category.missing', 'Category name is required.', rowId));
    }
    if (!productName) {
      issues.push(buildIssue('error', 'row.product.missing', 'Product name is required.', rowId));
    }

    const parsedPrice = parsePriceToInt(priceValue);
    const price = parsedPrice.value ?? 0;
    if (parsedPrice.error || !priceValue) {
      issues.push(buildIssue('error', 'row.price.invalid', 'Price is missing or invalid.', rowId));
    }

    const attributes: Record<string, unknown> = {};
    headers.forEach((header, colIdx) => {
      if (mappedIndices.has(colIdx)) return;
      const value = safeString(row[colIdx]);
      if (!value) return;
      attributes[header] = coerceAttributeValue(value);
    });

    const variantExtraction = extractVariantAttributes(productName);
    const baseName = variantExtraction.baseNameRu || productName || 'Без названия';
    const mergedAttributes: Record<string, unknown> = { ...attributes };
    Object.entries(variantExtraction.attrs).forEach(([key, value]) => {
      if (value !== undefined && mergedAttributes[key] === undefined) {
        mergedAttributes[key] = value;
      }
    });

    let sku = skuValue ? normalizeSku(skuValue) : '';
    if (!sku) {
      sku = generateStableSku({
        category: categoryName,
        product: baseName,
        label: labelValue || variantExtraction.labelRu,
        price,
      });
      console.warn(`Missing SKU for CSV row ${index + 1}. Generated fallback SKU: ${sku}.`);
      issues.push(buildIssue('warning', 'row.sku.generated', 'Missing SKU, generated a fallback.', rowId));
    }

    const unit = typeof mergedAttributes.unit === 'string' ? mergedAttributes.unit : undefined;
    const productKey = buildProductKey(categoryName || 'Без категории', baseName);
    const rowFingerprint = buildRowFingerprint({
      productKey,
      labelRu: labelValue || variantExtraction.labelRu,
      priceRetail: price,
      unit,
    });

    const normalizedRow: ImportRow = {
      id: rowId,
      category: { ru: categoryName || 'Без категории' },
      product: {
        ru: baseName,
        ruOriginal: productName || 'Без названия',
        ruBase: baseName,
        descriptionRu: descriptionValue || undefined,
      },
      variant: {
        sku,
        price,
        labelRu: labelValue || variantExtraction.labelRu || undefined,
        attributes: Object.keys(mergedAttributes).length ? mergedAttributes : undefined,
      },
      productKey,
      rowFingerprint,
      source: { rowIndex: index + 1 },
      issues: issues.length ? issues : undefined,
    };

    normalizedRows.push(normalizedRow);
  });

  return { rows: normalizedRows, warnings, errors };
};
