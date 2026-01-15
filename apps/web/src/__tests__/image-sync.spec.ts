import { describe, expect, it, vi } from 'vitest';
import { buildDriveDirectUrl, normalizeSkuFromFilename, updateProductImageForVariant } from '../lib/images/driveSync';

describe('normalizeSkuFromFilename', () => {
  it('uppercases, trims, and removes spaces', () => {
    expect(normalizeSkuFromFilename(' ab 12 .jpg')).toBe('AB12');
  });

  it('drops extension', () => {
    expect(normalizeSkuFromFilename('sku-100.webp')).toBe('SKU-100');
  });
});

describe('buildDriveDirectUrl', () => {
  it('builds a drive direct URL', () => {
    expect(buildDriveDirectUrl('file123')).toBe('https://drive.google.com/uc?export=view&id=file123');
  });
});

describe('updateProductImageForVariant', () => {
  it('updates product image via variant productId', async () => {
    const prismaMock = {
      product: {
        update: vi.fn().mockResolvedValue({ id: 'p1' }),
      },
    };
    const updatedAt = new Date('2024-01-01T00:00:00.000Z');

    await updateProductImageForVariant(
      prismaMock as any,
      { productId: 'p1' } as any,
      'https://img',
      { imageSource: 'drive', imageSourceId: 'file123', imageUpdatedAt: updatedAt }
    );

    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        imageUrl: 'https://img',
        imageSource: 'drive',
        imageSourceId: 'file123',
        imageUpdatedAt: updatedAt,
      },
    });
  });
});
