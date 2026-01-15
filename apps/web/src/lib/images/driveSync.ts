import path from 'path';
import type { Variant } from '@qr/db';

export const buildDriveDirectUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=view&id=${fileId}`;

export const normalizeSkuFromFilename = (filename: string) => {
  const base = path.basename(filename, path.extname(filename));
  return base.trim().replace(/\s+/g, '').toUpperCase();
};

export const extensionFromMime = (mimeType: string) => {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
};

export const resolveImageKey = (sku: string, extension: string) => `products/${sku}.${extension}`;

export const updateProductImageForVariant = async (
  prismaClient: { product: { update: (args: any) => Promise<any> } },
  variant: Pick<Variant, 'productId'>,
  imageUrl: string,
  metadata?: { imageSource?: string; imageSourceId?: string; imageUpdatedAt?: Date }
) => {
  const data: Record<string, unknown> = { imageUrl };
  if (metadata?.imageSource) data.imageSource = metadata.imageSource;
  if (metadata?.imageSourceId) data.imageSourceId = metadata.imageSourceId;
  if (metadata?.imageUpdatedAt) data.imageUpdatedAt = metadata.imageUpdatedAt;

  return prismaClient.product.update({
    where: { id: variant.productId },
    data,
  });
};
