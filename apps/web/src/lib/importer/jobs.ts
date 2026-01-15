import { prisma, ImportJobStatus, ImportRowStatus, ImportSourceType } from '@qr/db';
import type { CsvMapping, ImportIssue, ImportRow } from './types';
import { normalizeSku } from './sku';

const sanitizeJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const hasRowErrors = (row: ImportRow) =>
  row.issues?.some((issue) => issue.level === 'error') ?? false;

const countIssues = (rows: ImportRow[], level: 'warning' | 'error') =>
  rows.reduce((total, row) => total + (row.issues?.filter((issue) => issue.level === level).length ?? 0), 0);

export const createImportJob = async (params: {
  userId: string;
  sourceType: ImportSourceType;
  checksum: string;
  fileName?: string;
  fileSize?: number;
  warnings: ImportIssue[];
  errors: ImportIssue[];
  rows: ImportRow[];
  mapping?: unknown;
  csv?: { headers: string[]; delimiter: string; mapping?: CsvMapping };
}) => {
  const { userId, sourceType, checksum, fileName, fileSize, warnings, errors, rows, csv, mapping } = params;

  const totals = {
    parsed: {
      rows: rows.length,
      errors: countIssues(rows, 'error') + errors.length,
      warnings: countIssues(rows, 'warning') + warnings.length,
      needsReview: rows.filter((row) => row.source?.needsReview).length,
    },
  };

  const job = await prisma.importJob.create({
    data: {
      createdByUserId: userId,
      sourceType,
      status: ImportJobStatus.PARSED,
      checksum,
      fileName,
      fileSize,
      totals: sanitizeJson(totals),
      warnings: sanitizeJson({ warnings, errors }),
      mapping: mapping ? sanitizeJson(mapping) : csv ? sanitizeJson(csv) : undefined,
    },
  });

  if (rows.length) {
    const rowRecords = rows.map((row, index) => {
      const rowIndex = row.source?.rowIndex ?? index + 1;
      const sku = row.variant.sku ? normalizeSku(row.variant.sku) : undefined;
      const status = hasRowErrors(row) ? ImportRowStatus.ERROR : ImportRowStatus.READY;
      const data = sanitizeJson({
        category: row.category,
        product: row.product,
        variant: row.variant,
        image: row.image,
        productKey: row.productKey,
        rowFingerprint: row.rowFingerprint,
        raw: row.raw,
        sortOrder: row.sortOrder,
        source: row.source,
      });

      return {
        importJobId: job.id,
        rowIndex,
        status,
        sku,
        needsReview: row.source?.needsReview ?? false,
        confidence: row.source?.confidence ?? null,
        errors: row.issues ? sanitizeJson(row.issues) : undefined,
        data,
      };
    });

    await prisma.importRow.createMany({ data: rowRecords });
  }

  return job;
};

export const importRowsFromDb = (rows: Array<{ id: string; data: unknown; errors: unknown }>): ImportRow[] =>
  rows.map((row) => {
    const data = (row.data ?? {}) as Omit<ImportRow, 'id' | 'issues'>;
    const issues = Array.isArray(row.errors) ? (row.errors as ImportIssue[]) : undefined;
    return {
      id: row.id,
      ...data,
      issues,
    };
  });
