import { describe, expect, it } from 'vitest';
import {
  normalizeCloudshopRows,
  normalizeCloudshopSku,
  parseCloudshopCategories,
  resolveCloudshopRetailPrice,
  resolveCloudshopSku,
} from '../lib/importer/cloudshop';

describe('CloudShop import helpers', () => {
  it('resolves SKU by priority and normalizes', () => {
    const primary = resolveCloudshopSku({
      article: ' АВ-12 ',
      barcode: 'BAR-2',
      code: 'CODE-3',
      name: 'Товар',
      category: 'Категория',
      unit: 'шт',
    });
    expect(primary.sku).toBe('AB-12');
    expect(primary.generated).toBe(false);

    const fallback = resolveCloudshopSku({
      article: '12',
      barcode: '',
      code: '',
      name: 'Товар',
      category: 'Категория',
      unit: 'шт',
    });
    expect(fallback.sku).toMatch(/^GEN-[A-F0-9]{40}$/);
    expect(fallback.generated).toBe(true);

    expect(normalizeCloudshopSku(' ab 12 ')).toBe('AB12');
  });

  it('parses categories and handles missing values', () => {
    const parsed = parseCloudshopCategories('Трубы; Фитинги,Краны|Резьба');
    expect(parsed.primary).toBe('Трубы');
    expect(parsed.all).toEqual(['Трубы', 'Фитинги', 'Краны', 'Резьба']);
    expect(parsed.needsReview).toBe(false);

    const missing = parseCloudshopCategories('');
    expect(missing.primary).toBe('Без категории');
    expect(missing.needsReview).toBe(true);
  });

  it('chooses prices based on strategy', () => {
    const raw = {
      'Цена продажи': '100',
      'Цена в «Склад»': '130',
      'Цена в «Доставка»': '120',
    };
    expect(resolveCloudshopRetailPrice(raw, 'sale')).toBe(100);
    expect(resolveCloudshopRetailPrice(raw, 'maxLocation')).toBe(130);
  });

  it('validates headers and fails on missing required fields', () => {
    const result = normalizeCloudshopRows({ headers: ['Категории'], rows: [] });
    const codes = result.errors.map((issue) => issue.code);
    expect(codes).toContain('HEADERS_MISSING');
    expect(result.errors.length).toBe(2);
    expect(result.rows.length).toBe(0);
  });

  it('flags needsReview for missing category, price, and image', () => {
    const headers = ['Наименование', 'Категории', 'Цена продажи', 'Изображение'];
    const { rows } = normalizeCloudshopRows({
      headers,
      rows: [['Товар', '', '0', '']],
    });
    const row = rows[0];
    expect(row.source?.needsReview).toBe(true);
    const codes = row.issues?.map((issue) => issue.code) ?? [];
    expect(codes).toEqual(expect.arrayContaining(['CATEGORY_MISSING', 'PRICE_ZERO', 'IMAGE_MISSING']));
  });

  it('builds location prices and stocks in attributes', () => {
    const headers = ['Наименование', 'Категории', 'Цена продажи', 'Цена в «Склад»', 'Остаток в Склад'];
    const { rows } = normalizeCloudshopRows({
      headers,
      rows: [['Товар', 'Категория', '100', '120', '5']],
    });
    const attributes = rows[0].variant.attributes as Record<string, unknown>;
    expect(attributes.pricesByLocation).toEqual({ Склад: 120 });
    expect(attributes.stockByLocation).toEqual({ Склад: 5 });
  });
});
