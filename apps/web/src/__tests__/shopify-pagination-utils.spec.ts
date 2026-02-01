import { describe, expect, it } from 'vitest';
import { getTotalPages, normalizeTotalCount } from '@/lib/shopify/pagination';

describe('pagination helpers', () => {
  it('normalizes total count and returns null when unknown', () => {
    expect(normalizeTotalCount(undefined)).toBeNull();
    expect(normalizeTotalCount(null)).toBeNull();
    expect(normalizeTotalCount(Number.NaN)).toBeNull();
  });

  it('keeps valid counts (including zero)', () => {
    expect(normalizeTotalCount(0)).toBe(0);
    expect(normalizeTotalCount(12)).toBe(12);
  });

  it('computes total pages from count', () => {
    expect(getTotalPages(120, 24)).toBe(5);
    expect(getTotalPages(0, 24)).toBe(1);
    expect(getTotalPages(null, 24)).toBeNull();
  });
});
