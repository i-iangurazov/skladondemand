export const normalizeWhitespace = (value: string) =>
  value
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeHeader = (value: string) => normalizeWhitespace(value).toLowerCase();

export const coerceAttributeValue = (value: string): string | number => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  const numeric = normalized.replace(/\s+/g, '').replace(',', '.');
  const numericMatch = numeric.match(/^-?\d+(?:\.\d+)?$/);
  if (numericMatch) {
    const parsed = Number(numericMatch[0]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return normalized;
};

export const safeString = (value: unknown) => {
  if (typeof value === 'string') return normalizeWhitespace(value);
  if (value === null || value === undefined) return '';
  return normalizeWhitespace(String(value));
};
