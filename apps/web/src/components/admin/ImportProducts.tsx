'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CloudshopCommitOptions,
  CsvMapping,
  ImportCommitResult,
  ImportOverrides,
  ImportParseResult,
  ImportRow,
  PriceMode,
} from '@/lib/importer/types';
import { buildProductKey } from '@/lib/importer/variant';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE = 25;
const CLOUDSHOP_PAGE_SIZE = 50;

const DEFAULT_CLOUDSHOP_OPTIONS: CloudshopCommitOptions = {
  priceStrategy: 'sale',
  wholesaleLocation: null,
  skipPriceZero: true,
  skipMissingImage: false,
};

type ImportSource = 'csv' | 'pdf' | 'cloudshop-xlsx';
type RowFilter = 'all' | 'needsReview' | 'errors' | 'priceZero' | 'skuGenerated' | 'missingImage';
type GroupOverride = { productId?: string; categoryRu?: string; labels: Record<string, string> };
type ProductSuggestion = { id: string; name: string; slug?: string; score: number };
type GroupSuggestion = { candidates: ProductSuggestion[]; ambiguous: boolean; potentialDuplicate: boolean };

const emptyMapping: CsvMapping = {
  categoryRu: undefined,
  productRu: undefined,
  sku: undefined,
  price: undefined,
  variantLabelRu: undefined,
  descriptionRu: undefined,
};

const hasError = (row: ImportRow) => row.issues?.some((issue) => issue.level === 'error') ?? false;

const escapeCsvValue = (value: string) => {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const buildErrorCsv = (rows: ImportRow[]) => {
  const header = ['rowIndex', 'rowId', 'sku', 'category', 'product', 'price', 'issues'];
  const lines = [header.join(',')];
  rows.forEach((row) => {
    const issues = row.issues?.map((issue) => `${issue.level}:${issue.message}`).join(' | ') ?? '';
    const rowIndex = row.source?.rowIndex?.toString() ?? '';
    lines.push(
      [
        rowIndex,
        row.id,
        row.variant.sku ?? '',
        row.category.ru,
        row.product.ru,
        row.variant.price.toString(),
        issues,
      ]
        .map(escapeCsvValue)
        .join(',')
    );
  });
  return lines.join('\n');
};

const inferSourceType = (file?: File | null): ImportSource | null => {
  if (!file) return null;
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xlsx')) return 'cloudshop-xlsx';
  return null;
};

const normalizeHeaderLabel = (value: string) =>
  value.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();

const extractLocationLabel = (header: string) => {
  const normalized = normalizeHeaderLabel(header);
  const lower = normalized.toLowerCase();
  if (!lower.startsWith('цена в')) return null;
  return normalized.slice('Цена в'.length).trim();
};

const hasIssueCode = (row: ImportRow, code: string) =>
  row.issues?.some((issue) => issue.code === code) ?? false;

const resolveCloudshopDisplayPrice = (row: ImportRow, options: CloudshopCommitOptions) => {
  const basePrice = row.variant.priceRetail ?? row.variant.price;
  if (options.priceStrategy !== 'maxLocation') return basePrice;

  const pricesByLocation =
    row.variant.attributes && typeof row.variant.attributes === 'object'
      ? (row.variant.attributes as Record<string, unknown>).pricesByLocation
      : undefined;

  if (pricesByLocation && typeof pricesByLocation === 'object') {
    const values = Object.values(pricesByLocation as Record<string, unknown>)
      .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
      .filter((value) => value > 0);
    if (values.length) {
      return Math.max(...values);
    }
  }

  return basePrice;
};

const formatAttrValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).replace(/\.0+$/, '');
  }
  if (typeof value === 'string') {
    return value.replace(',', '.').trim();
  }
  return '';
};

const buildAttributeSummary = (rows: ImportRow[]) => {
  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    parts.push(value);
  };

  rows.forEach((row) => {
    if (!row.variant.attributes || typeof row.variant.attributes !== 'object') return;
    const attrs = row.variant.attributes as Record<string, unknown>;
    const dn = formatAttrValue(attrs.dn);
    if (dn) push(`DN${dn}`);
    const diameter = formatAttrValue(attrs.diameter_mm);
    if (diameter) push(`D${diameter}мм`);
    const thread = formatAttrValue(attrs.thread);
    if (thread) push(thread);
    const length = formatAttrValue(attrs.length_m);
    if (length) push(`${length}м`);
    const size = formatAttrValue(attrs.size);
    if (size) push(size);
  });

  return parts.slice(0, 6).join(' · ');
};

const getRowGroupKey = (row: ImportRow) => {
  const baseName = row.product.ruBase ?? row.product.ru;
  return row.productKey || buildProductKey(row.category.ru || 'Без категории', baseName);
};

const getRowLabelKey = (row: ImportRow) => row.rowFingerprint ?? row.id;

export default function ImportProducts() {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>(emptyMapping);
  const [columns, setColumns] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [commitReport, setCommitReport] = useState<ImportCommitResult | null>(null);
  const [undoResult, setUndoResult] = useState<{
    importId: string;
    reverted: { categories: number; products: number; variants: number };
  } | null>(null);
  const [search, setSearch] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<ImportSource>('csv');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [cloudshopOptions, setCloudshopOptions] =
    useState<CloudshopCommitOptions>(DEFAULT_CLOUDSHOP_OPTIONS);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [groupOverrides, setGroupOverrides] = useState<Record<string, GroupOverride>>({});
  const [groupSuggestions, setGroupSuggestions] = useState<Record<string, GroupSuggestion>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({});

  const priceMode: PriceMode = 'retail';
  const isCsv = sourceType === 'csv';
  const isPdf = sourceType === 'pdf';
  const isCloudshop = sourceType === 'cloudshop-xlsx';

  const extraColumns = useMemo(() => {
    if (!columns.length) return [];
    const used = new Set(Object.values(mapping).filter(Boolean));
    return columns.filter((column) => !used.has(column));
  }, [columns, mapping]);

  const filterCounts = useMemo(() => {
    const counts = {
      all: 0,
      needsReview: 0,
      errors: 0,
      priceZero: 0,
      skuGenerated: 0,
      missingImage: 0,
    };

    if (!parseResult?.rows.length) return counts;

    parseResult.rows.forEach((row) => {
      counts.all += 1;
      if (row.source?.needsReview) counts.needsReview += 1;
      if (hasError(row)) counts.errors += 1;
      if (hasIssueCode(row, 'PRICE_ZERO')) counts.priceZero += 1;
      if (hasIssueCode(row, 'SKU_GENERATED')) counts.skuGenerated += 1;
      if (!row.image?.url || hasIssueCode(row, 'IMAGE_MISSING')) counts.missingImage += 1;
    });

    return counts;
  }, [parseResult]);

  const readyRowsCount = Math.max(0, filterCounts.all - filterCounts.errors);

  const filterOptions = useMemo(() => {
    if (isCloudshop) {
      return [
        { key: 'all' as const, label: 'All', count: filterCounts.all },
        { key: 'needsReview' as const, label: 'Needs review', count: filterCounts.needsReview },
        { key: 'errors' as const, label: 'Errors only', count: filterCounts.errors },
        { key: 'priceZero' as const, label: 'Price = 0', count: filterCounts.priceZero },
        { key: 'skuGenerated' as const, label: 'SKU generated', count: filterCounts.skuGenerated },
        { key: 'missingImage' as const, label: 'Missing image', count: filterCounts.missingImage },
      ];
    }

    return [
      { key: 'all' as const, label: 'All', count: filterCounts.all },
      { key: 'needsReview' as const, label: 'Needs review', count: filterCounts.needsReview },
      { key: 'errors' as const, label: 'Errors only', count: filterCounts.errors },
    ];
  }, [filterCounts, isCloudshop]);

  const filteredRows = useMemo(() => {
    if (!parseResult?.rows.length) return [];
    const term = search.trim().toLowerCase();
    let baseRows = parseResult.rows;

    if (term) {
      baseRows = baseRows.filter((row) => {
        const name = row.product.ru.toLowerCase();
        const original = row.product.ruOriginal ? row.product.ruOriginal.toLowerCase() : '';
        return (
          name.includes(term) ||
          original.includes(term) ||
          (row.variant.sku ?? '').toLowerCase().includes(term)
        );
      });
    }

    switch (rowFilter) {
      case 'needsReview':
        return baseRows.filter((row) => row.source?.needsReview);
      case 'errors':
        return baseRows.filter((row) => hasError(row));
      case 'priceZero':
        return baseRows.filter((row) => hasIssueCode(row, 'PRICE_ZERO'));
      case 'skuGenerated':
        return baseRows.filter((row) => hasIssueCode(row, 'SKU_GENERATED'));
      case 'missingImage':
        return baseRows.filter((row) => !row.image?.url || hasIssueCode(row, 'IMAGE_MISSING'));
      case 'all':
      default:
        return baseRows;
    }
  }, [parseResult, rowFilter, search]);

  const groupedRows = useMemo(() => {
    if (!filteredRows.length) return [] as Array<{
      key: string;
      baseName: string;
      category: string;
      rows: ImportRow[];
      labels: string[];
      hasErrors: boolean;
      needsReviewCount: number;
      attributeSummary: string;
    }>;

    const map = new Map<string, {
      key: string;
      baseName: string;
      category: string;
      rows: ImportRow[];
      labels: Set<string>;
      hasErrors: boolean;
      needsReviewCount: number;
      order: number;
    }>();

    filteredRows.forEach((row) => {
      const key = getRowGroupKey(row);
      const baseName = row.product.ruBase ?? row.product.ru;
      const category = row.category.ru || 'Без категории';
      const order = row.source?.rowIndex ?? row.source?.page ?? 0;
      const label = row.variant.labelRu;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
        if (label) existing.labels.add(label);
        if (hasError(row)) existing.hasErrors = true;
        if (row.source?.needsReview) existing.needsReviewCount += 1;
        existing.order = Math.min(existing.order, order);
      } else {
        map.set(key, {
          key,
          baseName,
          category,
          rows: [row],
          labels: new Set(label ? [label] : []),
          hasErrors: hasError(row),
          needsReviewCount: row.source?.needsReview ? 1 : 0,
          order,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        key: group.key,
        baseName: group.baseName,
        category: group.category,
        rows: group.rows,
        labels: Array.from(group.labels),
        hasErrors: group.hasErrors,
        needsReviewCount: group.needsReviewCount,
        attributeSummary: buildAttributeSummary(group.rows),
      }));
  }, [filteredRows]);

  const needsReviewCount = useMemo(() => {
    if (!parseResult?.rows.length) return 0;
    if (typeof parseResult.needsReviewCount === 'number') return parseResult.needsReviewCount;
    return parseResult.rows.filter((row) => row.source?.needsReview).length;
  }, [parseResult]);

  const totalRows = parseResult?.totalRows ?? parseResult?.rows.length ?? 0;
  const sourceLabel = parseResult?.sourceType ?? sourceType;
  const sourceLabelText =
    sourceLabel === 'cloudshop-xlsx' ? 'CloudShop Excel (.xlsx)' : sourceLabel.toUpperCase();

  const showReviewBanner = useMemo(() => {
    if (!parseResult?.rows.length) return false;
    const threshold = Math.max(5, Math.ceil(parseResult.rows.length * 0.2));
    return needsReviewCount >= threshold && needsReviewCount > 0;
  }, [parseResult, needsReviewCount]);

  const reviewRequired = needsReviewCount > 0;

  const totalPages = Math.max(1, Math.ceil(groupedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedGroups = groupedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const locationPriceOptions = useMemo(() => {
    if (!columns.length) return [] as string[];
    const labels = columns
      .map((column) => extractLocationLabel(column))
      .filter((label): label is string => Boolean(label));
    return Array.from(new Set(labels));
  }, [columns]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleParse = async (overrideMapping?: CsvMapping) => {
    if (!file) return;
    setIsParsing(true);
    setError(null);
    setCommitReport(null);
    setUndoResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (overrideMapping && isCsv) {
      formData.append('mapping', JSON.stringify(overrideMapping));
    }

    try {
      if (!isCsv && !isPdf && !isCloudshop) {
        setError('errors.unsupportedFile');
        return;
      }
      const endpoint = isPdf
        ? '/api/admin/import/parse-pdf'
        : isCloudshop
          ? '/api/admin/import/parse-cloudshop-xlsx'
          : '/api/admin/import/parse-csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json()) as ImportParseResult & { code?: string };
      if (!response.ok) {
        setError(payload.code ?? 'errors.generic');
        return;
      }

      setParseResult(payload);
      setColumns(payload.columns ?? []);
      setMapping(payload.mapping ?? emptyMapping);
      setPage(1);
      setRowFilter('all');
      setCloudshopOptions(DEFAULT_CLOUDSHOP_OPTIONS);
      setExpandedGroups({});
      setGroupOverrides({});
      setGroupSuggestions({});
      setLoadingSuggestions({});
      if (payload.sourceType === 'cloudshop-xlsx') {
        setPageSize(CLOUDSHOP_PAGE_SIZE);
      } else {
        setPageSize(DEFAULT_PAGE_SIZE);
      }
      setReviewConfirmed(false);
    } catch (err) {
      setError('errors.generic');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!parseResult) return;
    setIsCommitting(true);
    setError(null);
    try {
      const overridesPayload = buildOverridesPayload();
      const payload = {
        importId: parseResult.importId,
        priceMode,
        checksum: parseResult.checksum,
        allowNeedsReview: reviewConfirmed,
        ...(overridesPayload ? { overrides: overridesPayload } : {}),
        ...(isCloudshop
          ? {
              priceStrategy: cloudshopOptions.priceStrategy,
              wholesaleLocation: cloudshopOptions.wholesaleLocation,
              skipPriceZero: cloudshopOptions.skipPriceZero,
              skipMissingImage: cloudshopOptions.skipMissingImage,
            }
          : {}),
      };

      const response = await fetch('/api/admin/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ImportCommitResult & { code?: string };
      if (!response.ok) {
        setError(result.code ?? 'errors.generic');
        return;
      }
      setCommitReport(result);
      setUndoResult(null);
    } catch (err) {
      setError('errors.generic');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleUndoLast = async () => {
    setIsUndoing(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/import/undo-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as
        | { importId: string; reverted: { categories: number; products: number; variants: number } }
        | { code?: string };
      if (!response.ok) {
        setError((payload as { code?: string }).code ?? 'errors.generic');
        return;
      }
      setUndoResult(
        payload as { importId: string; reverted: { categories: number; products: number; variants: number } }
      );
    } catch (err) {
      setError('errors.generic');
    } finally {
      setIsUndoing(false);
    }
  };

  const downloadErrors = () => {
    if (!parseResult) return;
    const errorRows = parseResult.rows.filter((row) => hasError(row));
    if (!errorRows.length) return;
    const csv = buildErrorCsv(errorRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `import-errors-${parseResult.importId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadSuggestions = async (groupKey: string, baseName: string, category: string) => {
    if (groupSuggestions[groupKey] || loadingSuggestions[groupKey]) return;
    setLoadingSuggestions((prev) => ({ ...prev, [groupKey]: true }));
    try {
      const response = await fetch('/api/admin/import/product-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseNameRu: baseName, categoryRu: category }),
      });
      const payload = (await response.json().catch(() => null)) as GroupSuggestion | null;
      if (response.ok && payload) {
        setGroupSuggestions((prev) => ({ ...prev, [groupKey]: payload }));
      }
    } catch {
      // ignore suggestion failures
    } finally {
      setLoadingSuggestions((prev) => ({ ...prev, [groupKey]: false }));
    }
  };

  const updateGroupOverride = (groupKey: string, update: Partial<GroupOverride>) => {
    setGroupOverrides((prev) => {
      const current = prev[groupKey] ?? { labels: {} };
      return { ...prev, [groupKey]: { ...current, ...update, labels: current.labels } };
    });
  };

  const updateLabelOverride = (groupKey: string, labelKey: string, value: string) => {
    setGroupOverrides((prev) => {
      const current = prev[groupKey] ?? { labels: {} };
      const labels = { ...current.labels };
      if (value.trim()) {
        labels[labelKey] = value;
      } else {
        delete labels[labelKey];
      }
      return { ...prev, [groupKey]: { ...current, labels } };
    });
  };

  const buildOverridesPayload = (): ImportOverrides | null => {
    const groups: ImportOverrides['groups'] = {};
    Object.entries(groupOverrides).forEach(([key, override]) => {
      const hasLabels = Object.keys(override.labels || {}).length > 0;
      if (override.productId || override.categoryRu || hasLabels) {
        groups[key] = {
          productId: override.productId,
          categoryRu: override.categoryRu,
          labels: hasLabels ? override.labels : undefined,
        };
      }
    });
    return Object.keys(groups).length ? { groups } : null;
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Upload import file</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-sm font-medium">Import type</span>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as ImportSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="cloudshop-xlsx">CloudShop Excel (.xlsx)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Input
              type="file"
              accept=".csv,.pdf,.xlsx"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                const inferred = inferSourceType(next);
                if (inferred) setSourceType(inferred);
                setParseResult(null);
                setCommitReport(null);
                setUndoResult(null);
                setColumns([]);
                setMapping(emptyMapping);
                setReviewConfirmed(false);
                setRowFilter('all');
                setCloudshopOptions(DEFAULT_CLOUDSHOP_OPTIONS);
                setExpandedGroups({});
                setGroupOverrides({});
                setGroupSuggestions({});
                setLoadingSuggestions({});
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleParse()} disabled={!file || isParsing}>
                {isParsing ? 'Parsing...' : 'Parse file'}
              </Button>
              {parseResult && (
                <Button variant="secondary" onClick={downloadErrors} disabled={!parseResult.rows.some(hasError)}>
                  Download errors as CSV
                </Button>
              )}
              <Button variant="destructive" onClick={handleUndoLast} disabled={isUndoing}>
                {isUndoing ? 'Undoing...' : 'Undo last import'}
              </Button>
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {parseResult && parseResult.sourceType === 'csv' && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">CSV column mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  { key: 'categoryRu', label: 'category_ru (required)' },
                  { key: 'productRu', label: 'product_ru (required)' },
                  { key: 'price', label: 'price (required)' },
                  { key: 'sku', label: 'sku' },
                  { key: 'variantLabelRu', label: 'variant_label_ru' },
                  { key: 'descriptionRu', label: 'description_ru' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-2 text-sm">
                  <span className="text-sm font-medium">{label}</span>
                  <Select
                    value={mapping[key] ?? 'none'}
                    onValueChange={(value) => {
                      setMapping((prev) => ({ ...prev, [key]: value === 'none' ? undefined : value }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not mapped</SelectItem>
                      {columns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Extra columns stored in attributes:</span>
              {extraColumns.length ? (
                extraColumns.map((column) => (
                  <Badge key={column} variant="secondary" className="font-normal">
                    {column}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary" className="font-normal">
                  None
                </Badge>
              )}
            </div>
            <Button onClick={() => handleParse(mapping)} disabled={isParsing}>
              {isParsing ? 'Updating...' : 'Apply mapping'}
            </Button>
          </CardContent>
        </Card>
      )}

      {parseResult && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">File info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">Source: {sourceLabelText}</Badge>
              <Badge variant="secondary">Rows: {totalRows}</Badge>
              <Badge variant="secondary">Columns: {columns.length}</Badge>
              {file?.name && <Badge variant="secondary">File: {file.name}</Badge>}
            </div>
            {columns.length ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {columns.map((column) => (
                  <Badge key={column} variant="secondary" className="font-normal">
                    {column}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No columns detected.</div>
            )}
          </CardContent>
        </Card>
      )}

      {parseResult && (parseResult.errors.length || parseResult.warnings.length) && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Warnings and errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {parseResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-destructive">Errors</div>
                <div className="space-y-1 text-destructive">
                  {parseResult.errors.map((issue, idx) => (
                    <div key={`err-${idx}`}>{issue.message}</div>
                  ))}
                </div>
              </div>
            )}
            {parseResult.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-amber-900">Warnings</div>
                <div className="space-y-1 text-amber-900">
                  {parseResult.warnings.map((issue, idx) => (
                    <div key={`warn-${idx}`}>{issue.message}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {parseResult && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Preview rows</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">Total: {filterCounts.all}</Badge>
              <Badge variant="secondary">Ready: {readyRowsCount}</Badge>
              <Badge variant="secondary">Errors: {filterCounts.errors}</Badge>
              <Badge variant="secondary">Needs review: {needsReviewCount}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showReviewBanner && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Many rows look low confidence. Please review them carefully before committing.
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Input
                placeholder="Search by name or SKU"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="max-w-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                {filterOptions.map((option) => (
                  <Button
                    key={option.key}
                    size="sm"
                    variant={rowFilter === option.key ? 'default' : 'secondary'}
                    onClick={() => {
                      setRowFilter(option.key);
                      setPage(1);
                    }}
                  >
                    {option.label} ({option.count})
                  </Button>
                ))}
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              {pagedGroups.map((group) => {
                const override = groupOverrides[group.key] ?? { labels: {} };
                const suggestions = groupSuggestions[group.key];
                const isExpanded = expandedGroups[group.key] ?? false;
                const labelSummary = group.labels.slice(0, 4).join(', ');
                const detailSummary = group.attributeSummary || labelSummary;
                const needsAttention = group.needsReviewCount > 0 || group.hasErrors;
                const suggestionsLoading = loadingSuggestions[group.key] ?? false;

                return (
                  <div key={group.key} className="rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isExpanded;
                        setExpandedGroups((prev) => ({ ...prev, [group.key]: next }));
                        if (next) {
                          loadSuggestions(group.key, group.baseName, group.category);
                        }
                      }}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">{group.baseName}</div>
                        <Badge variant="secondary" className="font-normal">
                          {group.rows.length} variants
                        </Badge>
                        {group.needsReviewCount > 0 && (
                          <Badge variant="secondary" className="font-normal">
                            Needs review
                          </Badge>
                        )}
                        {group.hasErrors && (
                          <Badge variant="destructive" className="font-normal">
                            Errors
                          </Badge>
                        )}
                        {suggestions?.ambiguous && (
                          <Badge variant="destructive" className="font-normal">
                            Ambiguous match
                          </Badge>
                        )}
                        {suggestions?.potentialDuplicate && !suggestions?.ambiguous && (
                          <Badge variant="secondary" className="font-normal">
                            Potential duplicate
                          </Badge>
                        )}
                        {needsAttention && (
                          <Badge variant="outline" className="font-normal">
                            Review
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.category}
                        {detailSummary ? ` · ${detailSummary}` : ''}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/60 px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              Category override
                            </span>
                            <Input
                              value={override.categoryRu ?? ''}
                              onChange={(event) =>
                                updateGroupOverride(group.key, {
                                  categoryRu: event.target.value.trim() ? event.target.value : undefined,
                                })
                              }
                              placeholder={group.category}
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              Target product
                            </span>
                            <Select
                              value={override.productId ?? 'none'}
                              onValueChange={(value) =>
                                updateGroupOverride(group.key, {
                                  productId: value === 'none' ? undefined : value,
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Create new product" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Create new product</SelectItem>
                                {suggestions?.candidates.map((candidate) => (
                                  <SelectItem key={candidate.id} value={candidate.id}>
                                    {candidate.name} ({Math.round(candidate.score * 100)}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {suggestionsLoading && (
                              <div className="text-xs text-muted-foreground">Loading suggestions...</div>
                            )}
                            {!suggestionsLoading && suggestions && suggestions.candidates.length === 0 && (
                              <div className="text-xs text-muted-foreground">No suggested matches.</div>
                            )}
                          </label>
                        </div>

                        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full min-w-[1024px] text-sm">
                            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left">Image</th>
                                <th className="px-3 py-2 text-left">Product (original)</th>
                                <th className="px-3 py-2 text-left">SKU</th>
                                <th className="px-3 py-2 text-left">Price</th>
                                <th className="px-3 py-2 text-left">Label</th>
                                <th className="px-3 py-2 text-left">Issues</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {group.rows.map((row) => {
                                const disabled = hasError(row);
                                const price = isCloudshop
                                  ? resolveCloudshopDisplayPrice(row, cloudshopOptions)
                                  : row.variant.priceRetail ?? row.variant.price;
                                const labelKey = getRowLabelKey(row);
                                const labelOverride = override.labels?.[labelKey];
                                const originalName = row.product.ruOriginal ?? row.product.ru;

                                return (
                                  <tr
                                    key={row.id}
                                    className={cn(
                                      'transition-colors odd:bg-muted/20 hover:bg-muted/30',
                                      disabled && 'opacity-60'
                                    )}
                                  >
                                    <td className="px-3 py-2">
                                      {row.image?.url ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewImage({
                                              url: row.image?.url ?? '',
                                              label: originalName,
                                            })
                                          }
                                          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20"
                                        >
                                          <img
                                            src={row.image.url}
                                            alt={originalName}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                          />
                                        </button>
                                      ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 text-[10px] uppercase text-muted-foreground">
                                          none
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">{originalName}</td>
                                    <td className="px-3 py-2">{row.variant.sku ?? '—'}</td>
                                    <td className="px-3 py-2">{price}</td>
                                    <td className="px-3 py-2">
                                      <Input
                                        value={labelOverride ?? row.variant.labelRu ?? ''}
                                        onChange={(event) =>
                                          updateLabelOverride(group.key, labelKey, event.target.value)
                                        }
                                        className="h-8"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        {row.source?.needsReview && (
                                          <Badge variant="secondary" className="font-normal">
                                            Needs review
                                          </Badge>
                                        )}
                                        {row.issues?.map((issue, idx) => (
                                          <Badge
                                            key={`${row.id}-${idx}`}
                                            variant={issue.level === 'error' ? 'destructive' : 'secondary'}
                                            className="font-normal"
                                          >
                                            {issue.message}
                                          </Badge>
                                        ))}
                                        {!row.source?.needsReview && !row.issues?.length && (
                                          <Badge variant="secondary" className="font-normal">
                                            OK
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <div>
                Page {currentPage} of {totalPages} · Groups {groupedRows.length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>

            {isCloudshop && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="text-sm font-medium">Commit options</div>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs font-medium uppercase text-muted-foreground">Price strategy</span>
                    <Select
                      value={cloudshopOptions.priceStrategy}
                      onValueChange={(value) =>
                        setCloudshopOptions((prev) => ({
                          ...prev,
                          priceStrategy: value === 'maxLocation' ? 'maxLocation' : 'sale',
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Use “Цена продажи”</SelectItem>
                        <SelectItem value="maxLocation">Max location price</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Wholesale mapping
                    </span>
                    <Select
                      value={cloudshopOptions.wholesaleLocation ?? 'none'}
                      onValueChange={(value) =>
                        setCloudshopOptions((prev) => ({
                          ...prev,
                          wholesaleLocation: value === 'none' ? null : value,
                        }))
                      }
                      disabled={!locationPriceOptions.length}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {locationPriceOptions.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cloudshopOptions.skipPriceZero}
                      onChange={(event) =>
                        setCloudshopOptions((prev) => ({
                          ...prev,
                          skipPriceZero: event.target.checked,
                        }))
                      }
                    />
                    Skip rows where price = 0
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cloudshopOptions.skipMissingImage}
                      onChange={(event) =>
                        setCloudshopOptions((prev) => ({
                          ...prev,
                          skipMissingImage: event.target.checked,
                        }))
                      }
                    />
                    Skip rows without image
                  </label>
                </div>
                {reviewRequired && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={reviewConfirmed}
                      onChange={(event) => setReviewConfirmed(event.target.checked)}
                    />
                    I reviewed low-confidence rows
                  </label>
                )}
              </div>
            )}

            {!isCloudshop && reviewRequired && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                />
                I reviewed low-confidence rows
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleCommit}
                disabled={isCommitting || !parseResult?.rows.length || (reviewRequired && !reviewConfirmed)}
              >
                {isCommitting ? 'Committing...' : 'Commit import'}
              </Button>
            </div>

            {commitReport && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                <div className="font-medium">Import summary</div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-4">
                  <div>Created: {commitReport.created}</div>
                  <div>Updated: {commitReport.updated}</div>
                  <div>Skipped: {commitReport.skipped}</div>
                  <div>Failed: {commitReport.failed}</div>
                </div>
              </div>
            )}
            {undoResult && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                <div className="font-medium">Undo completed</div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                  <div>Import ID: {undoResult.importId}</div>
                  <div>Categories disabled: {undoResult.reverted.categories}</div>
                  <div>Products disabled: {undoResult.reverted.products}</div>
                  <div>Variants disabled: {undoResult.reverted.variants}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          {previewImage?.url ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <img
                src={previewImage.url}
                alt={previewImage.label}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No image available.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
