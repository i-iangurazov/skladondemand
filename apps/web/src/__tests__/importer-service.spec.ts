import { describe, expect, it, vi } from 'vitest';
import { createImportContext, upsertImportRow } from '../lib/importer/service';
import type { ImportRow } from '../lib/importer/types';

const baseRow: ImportRow = {
  id: 'row-1',
  category: { ru: 'Категория' },
  product: { ru: 'Товар', descriptionRu: 'Описание' },
  variant: { sku: 'SKU123', price: 210, labelRu: 'Вариант', attributes: { size: 'M' } },
};

const makeTx = () => ({
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
  categoryTranslation: {
    create: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  productTranslation: {
    upsert: vi.fn(),
  },
  variant: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  variantTranslation: {
    upsert: vi.fn(),
  },
});

describe('upsertImportRow', () => {
  it('creates category/product/variant when SKU is new', async () => {
    const tx = makeTx();
    tx.variant.findUnique.mockResolvedValue(null);
    tx.category.findFirst.mockResolvedValue(null);
    tx.category.create.mockResolvedValue({ id: 'cat1', translations: [] });
    tx.product.findFirst.mockResolvedValue(null);
    tx.product.findMany.mockResolvedValue([]);
    tx.product.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    tx.product.create.mockResolvedValue({ id: 'prod1', translations: [] });
    tx.variant.create.mockResolvedValue({ id: 'var1' });

    const ctx = createImportContext(0);
    const result = await upsertImportRow(tx as any, ctx, baseRow);

    expect(result.status).toBe('created');
    expect(tx.category.create).toHaveBeenCalled();
    expect(tx.product.create).toHaveBeenCalled();
    expect(tx.variant.create).toHaveBeenCalled();
  });

  it('updates variant and translations when SKU exists', async () => {
    const tx = makeTx();
    tx.variant.findUnique.mockResolvedValue({
      id: 'var1',
      productId: 'prod1',
      attributes: { supplier: 'Old', pricesByLocation: { A: 100 }, stockByLocation: { A: 5 } },
      product: { translations: [], imageUrl: null, variants: [] },
      translations: [],
    });

    const ctx = createImportContext(0);
    const row = {
      ...baseRow,
      variant: {
        ...baseRow.variant,
        attributes: {
          supplier: '',
          unit: 'шт',
          pricesByLocation: { B: 200 },
          stockByLocation: { B: 3 },
        },
      },
    };
    const result = await upsertImportRow(tx as any, ctx, row);

    expect(result.status).toBe('updated');
    expect(tx.variant.update).toHaveBeenCalled();
    expect(tx.productTranslation.upsert).toHaveBeenCalled();
    expect(tx.variantTranslation.upsert).toHaveBeenCalled();
    expect(tx.category.create).not.toHaveBeenCalled();

    const updateArgs = tx.variant.update.mock.calls[0][0];
    expect(updateArgs.data.attributes).toEqual({
      supplier: 'Old',
      unit: 'шт',
      pricesByLocation: { A: 100, B: 200 },
      stockByLocation: { A: 5, B: 3 },
    });
  });

  it('matches variant by label and attributes when SKU is missing', async () => {
    const tx = makeTx();
    tx.variant.findUnique.mockResolvedValue(null);
    tx.category.findFirst.mockResolvedValue({ id: 'cat1', slug: 'категория', translations: [] });
    tx.product.findFirst.mockResolvedValue(null);
    tx.product.findMany.mockResolvedValue([
      {
        id: 'prod1',
        slug: 'kategoriya-truba',
        imageUrl: null,
        translations: [{ locale: 'ru', name: 'Труба' }],
        variants: [
          {
            id: 'var1',
            sku: null,
            attributes: { dn: 15 },
            translations: [{ locale: 'ru', label: 'DN15' }],
          },
        ],
      },
    ]);
    tx.variant.update.mockResolvedValue({ id: 'var1' });

    const ctx = createImportContext(0);
    const row = {
      ...baseRow,
      variant: { ...baseRow.variant, sku: undefined, labelRu: 'DN15', attributes: { dn: 15 } },
      product: { ...baseRow.product, ru: 'Труба' },
    };
    const result = await upsertImportRow(tx as any, ctx, row);

    expect(result.status).toBe('updated');
    expect(tx.variant.update).toHaveBeenCalled();
  });
});
