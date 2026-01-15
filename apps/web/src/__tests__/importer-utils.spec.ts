import { describe, expect, it, vi } from 'vitest';
import { parsePriceToInt } from '../lib/importer/price';
import { generateStableSku, normalizeSku } from '../lib/importer/sku';
import { parseCsvContent, normalizeCsvRows, suggestCsvMapping } from '../lib/importer/csv';
import { extractVariantAttributes, generateVariantSku } from '../lib/importer/variant';
import { findVariantMatch, resolveProductMatch } from '../lib/importer/resolver';

const suppressWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

describe('parsePriceToInt', () => {
  it('parses common currency formats', () => {
    expect(parsePriceToInt('210').value).toBe(210);
    expect(parsePriceToInt('210 сом').value).toBe(210);
    expect(parsePriceToInt('210 KGS').value).toBe(210);
    expect(parsePriceToInt('210.00').value).toBe(210);
    expect(parsePriceToInt('1 200,50').value).toBe(1201);
  });
});

describe('generateStableSku', () => {
  it('is stable for the same inputs', () => {
    const sku1 = generateStableSku({ category: 'A', product: 'B', label: 'C', price: 100 });
    const sku2 = generateStableSku({ category: 'A', product: 'B', label: 'C', price: 100 });
    expect(sku1).toBe(sku2);
  });

  it('changes when price changes', () => {
    const sku1 = generateStableSku({ category: 'A', product: 'B', label: 'C', price: 100 });
    const sku2 = generateStableSku({ category: 'A', product: 'B', label: 'C', price: 200 });
    expect(sku1).not.toBe(sku2);
  });
});

describe('normalizeSku', () => {
  it('uppercases and removes spaces', () => {
    expect(normalizeSku(' ab c-12 ')).toBe('ABC-12');
  });
});

describe('parseCsvContent', () => {
  it('detects delimiter and parses rows', () => {
    const csv = 'Category;Product;Price\nPipes;Valve;210';
    const result = parseCsvContent(csv);
    expect(result.delimiter).toBe(';');
    expect(result.headers).toEqual(['Category', 'Product', 'Price']);
    expect(result.rows[0]).toEqual(['Pipes', 'Valve', '210']);
  });
});

describe('normalizeCsvRows', () => {
  it('maps columns and generates fallback sku', () => {
    const warn = suppressWarn();
    const headers = ['Категория', 'Товар', 'Цена'];
    const mapping = suggestCsvMapping(headers, 'retail');
    const { rows, errors } = normalizeCsvRows({ headers, rows: [['Трубы', 'Кран', '210']], mapping });
    expect(errors.length).toBe(0);
    expect(rows[0].category.ru).toBe('Трубы');
    expect(rows[0].product.ru).toBe('Кран');
    expect(rows[0].variant.price).toBe(210);
    expect(rows[0].variant.sku).toMatch(/^[A-F0-9]{64}$/);
    warn.mockRestore();
  });

  it('stores unmapped columns as attributes', () => {
    const warn = suppressWarn();
    const headers = ['Категория', 'Товар', 'Цена', 'Материал'];
    const mapping = suggestCsvMapping(headers, 'retail');
    const { rows } = normalizeCsvRows({ headers, rows: [['Фитинги', 'Муфта', '100', 'Латунь']], mapping });
    expect(rows[0].variant.attributes).toEqual({ Материал: 'Латунь' });
    warn.mockRestore();
  });

  it('normalizes sku values', () => {
    const warn = suppressWarn();
    const headers = ['Категория', 'Товар', 'Цена', 'SKU'];
    const mapping = suggestCsvMapping(headers, 'retail');
    const { rows } = normalizeCsvRows({ headers, rows: [['Фитинги', 'Муфта', '100', ' ab 12 ']], mapping });
    expect(rows[0].variant.sku).toBe('AB12');
    warn.mockRestore();
  });
});

describe('extractVariantAttributes', () => {
  it('extracts diameter, dn, length, size, and thread', () => {
    const diameter = extractVariantAttributes('Труба Ф40');
    expect(diameter.attrs.diameter_mm).toBe(40);
    expect(diameter.labelRu).toContain('Ф40');

    const dn = extractVariantAttributes('Кран DN15');
    expect(dn.attrs.dn).toBe(15);
    expect(dn.labelRu).toContain('DN15');

    const dmm = extractVariantAttributes('Переход D 9мм');
    expect(dmm.attrs.diameter_mm).toBe(9);
    expect(dmm.labelRu).toContain('D9мм');

    const length = extractVariantAttributes('Кабель 2.5м');
    expect(length.attrs.length_m).toBe(2.5);
    expect(length.labelRu).toContain('2.5м');

    const size = extractVariantAttributes('Переход 110х50');
    expect(size.attrs.size).toBe('110x50');
    expect(size.labelRu).toContain('110x50');

    const thread = extractVariantAttributes('Муфта 1/2');
    expect(thread.attrs.thread).toContain('1/2');
  });

  it('removes variant tokens from base name', () => {
    const result = extractVariantAttributes('Труба DN15 2.5м');
    expect(result.baseNameRu).toBe('Труба');
  });
});

describe('resolver matching', () => {
  it('matches same base name with different sizes to the same product', () => {
    const product = {
      id: 'p1',
      translations: [{ locale: 'ru', name: 'Труба' }],
      variants: [
        {
          id: 'v1',
          translations: [{ locale: 'ru', label: 'DN15' }],
          attributes: { dn: 15 },
        },
      ],
    };
    const resolution = resolveProductMatch([product], {
      baseName: 'Труба',
      label: 'DN20',
      attrs: { dn: 20 },
    });
    expect(resolution.best?.product.id).toBe('p1');
  });

  it('flags ambiguous matches', () => {
    const products = [
      { id: 'p1', translations: [{ locale: 'ru', name: 'Муфта' }], variants: [] },
      { id: 'p2', translations: [{ locale: 'ru', name: 'Муфта' }], variants: [] },
    ];
    const resolution = resolveProductMatch(products, { baseName: 'Муфта' });
    expect(resolution.ambiguous).toBe(true);
    expect(resolution.best).toBeNull();
  });

  it('matches variants by attributes when label is missing', () => {
    const product = {
      id: 'p1',
      translations: [{ locale: 'ru', name: 'Труба' }],
      variants: [
        {
          id: 'v2',
          translations: [{ locale: 'ru', label: 'DN20' }],
          attributes: { dn: 20 },
        },
      ],
    };
    const match = findVariantMatch(product, { baseName: 'Труба', attrs: { dn: 20 } });
    expect(match?.id).toBe('v2');
  });
});

describe('generateVariantSku', () => {
  it('is stable for the same inputs', () => {
    const sku1 = generateVariantSku({ productKey: 'pipes::valve', labelRu: 'DN15', unit: 'шт' });
    const sku2 = generateVariantSku({ productKey: 'pipes::valve', labelRu: 'DN15', unit: 'шт' });
    expect(sku1).toBe(sku2);
  });
});
