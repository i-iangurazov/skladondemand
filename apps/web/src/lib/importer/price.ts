export const parsePriceToInt = (value: string) => {
  const raw = value.replace(/[\u00A0\u2007\u202F]/g, ' ').trim();
  if (!raw) return { value: null as number | null, error: 'empty' };

  const stripped = raw.replace(/[^\d.,-]/g, '');
  if (!stripped) return { value: null as number | null, error: 'noDigits' };

  let normalized = stripped;
  const hasDot = normalized.includes('.');
  const hasComma = normalized.includes(',');

  if (hasDot && hasComma) {
    const lastDot = normalized.lastIndexOf('.');
    const lastComma = normalized.lastIndexOf(',');
    const decimalIndex = Math.max(lastDot, lastComma);
    const integerPart = normalized.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = normalized.slice(decimalIndex + 1);
    normalized = `${integerPart}.${decimalPart}`;
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return { value: null as number | null, error: 'invalid' };

  return { value: Math.round(parsed), error: null as string | null };
};
