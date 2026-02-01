import { describe, expect, it } from 'vitest';
import { normalizeHandle } from '@/lib/shopify/handle';

describe('normalizeHandle', () => {
  it('strips collection prefixes and slashes', () => {
    expect(normalizeHandle('collections/men')).toBe('men');
    expect(normalizeHandle('/collections/men/')).toBe('men');
    expect(normalizeHandle('collection/men')).toBe('men');
  });

  it('returns null for empty values', () => {
    expect(normalizeHandle('')).toBeNull();
    expect(normalizeHandle('   ')).toBeNull();
    expect(normalizeHandle(undefined)).toBeNull();
  });
});
