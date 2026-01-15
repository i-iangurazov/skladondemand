import { describe, expect, it } from 'vitest';
import {
  buildProductKey,
  extractVariantAttributes,
  generateVariantSku,
} from '../lib/importer/variant';

describe('variant extraction', () => {
  it('extracts DN and base name', () => {
    const result = extractVariantAttributes('Труба DN15');
    expect(result.attrs.dn).toBe(15);
    expect(result.labelRu).toContain('DN15');
    expect(result.baseNameRu).toBe('Труба');
  });

  it('extracts diameter and length', () => {
    const result = extractVariantAttributes('Кабель Ф40 2.5м');
    expect(result.attrs.diameter_mm).toBe(40);
    expect(result.attrs.length_m).toBe(2.5);
    expect(result.labelRu).toContain('Ф40');
    expect(result.labelRu).toContain('2.5м');
  });

  it('extracts D mm, size and thread', () => {
    const result = extractVariantAttributes('Труба D 9мм 110х50 1/2');
    expect(result.attrs.diameter_mm).toBe(9);
    expect(result.attrs.size).toBe('110x50');
    expect(result.attrs.thread).toBe('1/2');
  });

  it('generates stable product key and sku', () => {
    const productKey = buildProductKey('Категория', 'Труба');
    const skuA = generateVariantSku({ productKey, labelRu: 'DN15', unit: 'шт' });
    const skuB = generateVariantSku({ productKey, labelRu: 'DN15', unit: 'шт' });
    expect(skuA).toBe(skuB);
    expect(skuA).toMatch(/^GEN-[A-F0-9]{40}$/);
  });
});
