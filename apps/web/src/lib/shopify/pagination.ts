export const isUpperBrandTag = (value: string) => /^[A-Z0-9]{2,12}$/.test(value.trim());

export const normalizeTotalCount = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
};

export const getTotalPages = (totalCount: number | null | undefined, pageSize: number) => {
  const normalized = normalizeTotalCount(totalCount);
  if (normalized === null) return null;
  const safePageSize = pageSize > 0 ? pageSize : 1;
  return Math.max(1, Math.ceil(normalized / safePageSize));
};
