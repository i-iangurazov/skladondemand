import pdfParse from 'pdf-parse';
import { normalizeWhitespace } from './normalize';
import { parsePriceToInt } from './price';
import { generateFallbackSku } from './sku';
import { buildProductKey, buildRowFingerprint, extractVariantAttributes } from './variant';
import type { ImportIssue, ImportRow } from './types';

const SKU_REGEX = /\b[A-Z]{1,3}\d{3,6}\b/gi;
const PRICE_REGEX = /(\d{2,6}(?:[.,]\d{1,2})?)\s*(сом|kgs)?/gi;
const CATEGORY_REGEX = /^[^\dA-Za-z]*[А-ЯЁ\s-]{3,}$/u;

const buildIssue = (level: 'warning' | 'error', code: string, message: string, rowId?: string): ImportIssue => ({
  level,
  code,
  message,
  rowId,
});

const buildRowId = (page: number, index: number) => `pdf-${page + 1}-${index + 1}`;

const splitProductAndLabel = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return { product: '', label: '' };
  const separators = [' - ', ' — ', ' – ', ' / ', ' | ', ': '];
  for (const separator of separators) {
    if (normalized.includes(separator)) {
      const [product, ...rest] = normalized.split(separator);
      return { product: product.trim(), label: rest.join(separator).trim() };
    }
  }
  const match = normalized.match(/^(.*)\(([^)]+)\)$/);
  if (match) {
    return { product: match[1].trim(), label: match[2].trim() };
  }
  return { product: normalized, label: '' };
};

const extractSku = (value: string) => {
  const match = value.match(SKU_REGEX);
  if (!match || match.length === 0) return '';
  return match[0].toUpperCase();
};

const extractPrice = (value: string) => {
  const matches = Array.from(value.matchAll(PRICE_REGEX));
  if (!matches.length) return { value: null as number | null, raw: '' };
  const match = matches[matches.length - 1];
  const parsed = parsePriceToInt(match[1]);
  return { value: parsed.value ?? null, raw: match[1] };
};

const isCategoryHeading = (line: string) => {
  const normalized = normalizeWhitespace(line);
  if (!normalized) return false;
  if (normalized.length < 3) return false;
  if (/[\d]/.test(normalized)) return false;
  return CATEGORY_REGEX.test(normalized);
};

const isTableLikePage = (lines: string[]) => {
  if (!lines.length) return false;
  const numericHeavy = lines.filter((line) => (line.match(/\d+/g) || []).length >= 2).length;
  return numericHeavy / lines.length >= 0.3;
};

const parseTablePage = (lines: string[], pageIndex: number, currentCategory: { value: string }) => {
  const rows: ImportRow[] = [];
  let rowIndex = 0;

  lines.forEach((line) => {
    const normalized = normalizeWhitespace(line);
    if (!normalized) return;
    if (isCategoryHeading(normalized)) {
      currentCategory.value = normalized;
      return;
    }

    const price = extractPrice(normalized);
    const sku = extractSku(normalized);

    const stripped = normalized
      .replace(SKU_REGEX, '')
      .replace(PRICE_REGEX, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const split = splitProductAndLabel(stripped);
    if (!split.product && !price.value) return;

    const variantExtraction = extractVariantAttributes(split.product || '');
    const baseName = variantExtraction.baseNameRu || split.product || 'Без названия';
    const label = split.label || variantExtraction.labelRu || '';

    const rowId = buildRowId(pageIndex, rowIndex);
    rowIndex += 1;

    const issues: ImportIssue[] = [];
    let needsReview = false;
    let confidence = 0;

    if (price.value !== null) confidence += 0.4;
    if (sku) confidence += 0.3;
    if (split.product) confidence += 0.3;

    if (confidence < 0.6) {
      needsReview = true;
      issues.push(buildIssue('warning', 'pdf.lowConfidence', 'Low confidence row parse.', rowId));
    }

    if (!split.product) {
      issues.push(buildIssue('error', 'row.product.missing', 'Product name is required.', rowId));
      needsReview = true;
    }
    if (price.value === null) {
      issues.push(buildIssue('error', 'row.price.invalid', 'Price is missing or invalid.', rowId));
      needsReview = true;
    }

    let finalSku = sku;
    if (!finalSku) {
      finalSku = generateFallbackSku({
        category: currentCategory.value,
        product: baseName,
        label: label || split.product,
        price: price.value ?? undefined,
      });
      console.warn(`Missing SKU in PDF page ${pageIndex + 1}. Generated fallback SKU: ${finalSku}.`);
      issues.push(buildIssue('warning', 'row.sku.generated', 'Missing SKU, generated a fallback.', rowId));
      needsReview = true;
    }

    const productKey = buildProductKey(currentCategory.value || 'Без категории', baseName);
    const rowFingerprint = buildRowFingerprint({
      productKey,
      labelRu: label || undefined,
      priceRetail: price.value ?? undefined,
    });

    rows.push({
      id: rowId,
      category: { ru: currentCategory.value || 'Без категории' },
      product: {
        ru: baseName,
        ruOriginal: split.product || 'Без названия',
        ruBase: baseName,
      },
      variant: {
        sku: finalSku,
        price: price.value ?? 0,
        labelRu: label || undefined,
        attributes: Object.keys(variantExtraction.attrs).length ? variantExtraction.attrs : undefined,
      },
      productKey,
      rowFingerprint,
      source: { page: pageIndex + 1, confidence, needsReview },
      issues: issues.length ? issues : undefined,
    });
  });

  return rows;
};

const parseCardPage = (lines: string[], pageIndex: number, currentCategory: { value: string }) => {
  const rows: ImportRow[] = [];
  const blocks: string[][] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    const normalized = normalizeWhitespace(line);
    if (!normalized) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      return;
    }
    current.push(normalized);
  });
  if (current.length) blocks.push(current);

  let rowIndex = 0;

  blocks.forEach((block) => {
    if (!block.length) return;
    if (isCategoryHeading(block[0])) {
      currentCategory.value = block[0];
      return;
    }

    const blockText = block.join(' ');
    const sku = extractSku(blockText);
    const price = extractPrice(blockText);

    if (!sku && price.value === null) return;

    const title = block.find((line) => /[A-Za-zА-Яа-я]/.test(line)) ?? '';
    const label = block.length > 1 ? block[1] : '';
    const variantExtraction = extractVariantAttributes(title || '');
    const baseName = variantExtraction.baseNameRu || title || 'Без названия';
    const finalLabel = label || variantExtraction.labelRu || '';

    const rowId = buildRowId(pageIndex, rowIndex);
    rowIndex += 1;

    const issues: ImportIssue[] = [];
    let confidence = 0.3;
    if (sku) confidence += 0.2;
    if (price.value !== null) confidence += 0.3;
    if (title) confidence += 0.2;

    const needsReview = confidence < 0.6;
    if (needsReview) {
      issues.push(buildIssue('warning', 'pdf.lowConfidence', 'Low confidence row parse.', rowId));
    }

    if (!title) {
      issues.push(buildIssue('error', 'row.product.missing', 'Product name is required.', rowId));
    }
    if (price.value === null) {
      issues.push(buildIssue('error', 'row.price.invalid', 'Price is missing or invalid.', rowId));
    }

    let finalSku = sku;
    if (!finalSku) {
      finalSku = generateFallbackSku({
        category: currentCategory.value,
        product: baseName,
        label: finalLabel || title,
        price: price.value ?? undefined,
      });
      console.warn(`Missing SKU in PDF page ${pageIndex + 1}. Generated fallback SKU: ${finalSku}.`);
      issues.push(buildIssue('warning', 'row.sku.generated', 'Missing SKU, generated a fallback.', rowId));
    }

    const productKey = buildProductKey(currentCategory.value || 'Без категории', baseName);
    const rowFingerprint = buildRowFingerprint({
      productKey,
      labelRu: finalLabel || undefined,
      priceRetail: price.value ?? undefined,
    });

    rows.push({
      id: rowId,
      category: { ru: currentCategory.value || 'Без категории' },
      product: {
        ru: baseName,
        ruOriginal: title || 'Без названия',
        ruBase: baseName,
      },
      variant: {
        sku: finalSku,
        price: price.value ?? 0,
        labelRu: finalLabel || undefined,
        attributes: Object.keys(variantExtraction.attrs).length ? variantExtraction.attrs : undefined,
      },
      productKey,
      rowFingerprint,
      source: { page: pageIndex + 1, confidence, needsReview },
      issues: issues.length ? issues : undefined,
    });
  });

  return rows;
};

export const parsePdfBuffer = async (buffer: Buffer) => {
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];
  const pages: string[] = [];

  try {
    await pdfParse(buffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        const linesMap = new Map<number, string[]>();

        textContent.items.forEach((item: any) => {
          const y = Math.round(item.transform?.[5] ?? 0);
          const existing = linesMap.get(y) ?? [];
          existing.push(item.str ?? '');
          linesMap.set(y, existing);
        });

        const ordered = Array.from(linesMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, parts]) => parts.join(' '));
        const pageText = ordered.join('\n');
        pages.push(pageText);
        return pageText;
      },
    });
  } catch (error) {
    console.error(error);
    errors.push(buildIssue('error', 'pdf.parse.failed', 'Failed to parse PDF file.'));
    return { rows: [], warnings, errors };
  }

  if (!pages.length) {
    warnings.push(buildIssue('warning', 'pdf.empty', 'No text found in PDF.'));
    return { rows: [], warnings, errors };
  }

  const rows: ImportRow[] = [];
  const category = { value: '' };

  pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split(/\r?\n/).map((line) => normalizeWhitespace(line));
    const filtered = lines.filter((line) => line);
    if (!filtered.length) return;

    const tableLike = isTableLikePage(filtered);
    const pageRows = tableLike
      ? parseTablePage(filtered, pageIndex, category)
      : parseCardPage(filtered, pageIndex, category);

    rows.push(...pageRows);
  });

  if (!rows.length) {
    warnings.push(buildIssue('warning', 'pdf.noRows', 'No rows detected in PDF.'));
  }

  return { rows, warnings, errors };
};
