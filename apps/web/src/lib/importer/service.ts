import { prisma, Locale, Prisma } from '@qr/db';
import type { ImportCommitResult, ImportRow, PriceMode } from './types';
import { normalizeWhitespace } from './normalize';
import { normalizeSku } from './sku';
import { slugify } from './slug';
import { buildProductKey, generateVariantSku } from './variant';
import {
  DEFAULT_MATCH_THRESHOLD,
  findVariantMatch,
  getRuName,
  resolveProductMatch,
  scoreNameSimilarity,
} from './resolver';

const CHUNK_SIZE = 200;

export type ImportDb = {
  category: {
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    aggregate?: (...args: any[]) => Promise<any>;
  };
  categoryTranslation: {
    create: (...args: any[]) => Promise<any>;
  };
  product: {
    findFirst: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    aggregate?: (...args: any[]) => Promise<any>;
  };
  productTranslation: {
    upsert: (...args: any[]) => Promise<any>;
  };
  variant: {
    findUnique: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
  variantTranslation: {
    upsert: (...args: any[]) => Promise<any>;
  };
};

type ImportContext = {
  nextCategorySortOrder: number;
  nextProductSortOrders: Map<string, number>;
  categoryCache: Map<string, any>;
  productCache: Map<string, any>;
  productBySlug: Map<string, any>;
  productsByCategory: Map<string, any[]>;
  variantBySku: Map<string, any>;
  productById: Map<string, any>;
};

type EnsureResult<T> = { record: T; created: boolean };

const chunkRows = <T>(rows: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const hasBlockingIssues = (row: ImportRow) =>
  row.issues?.some((issue) => issue.level === 'error') ?? false;

const categoryKey = (name: string) => normalizeWhitespace(name).toLowerCase();
const buildProductCacheKey = (categoryId: string, baseName: string, key?: string) =>
  key || `${categoryId}:${normalizeWhitespace(baseName).toLowerCase()}`;

const buildLocaleEntries = (input: { ru: string; en?: string; kg?: string }) => {
  const entries: Array<{ locale: Locale; name: string }> = [{ locale: Locale.ru, name: input.ru }];
  if (input.en) entries.push({ locale: Locale.en, name: input.en });
  if (input.kg) entries.push({ locale: Locale.kg, name: input.kg });
  return entries;
};

const buildProductTranslationEntries = (input: ImportRow['product']) => {
  const entries: Array<{ locale: Locale; name: string; description?: string }> = [
    { locale: Locale.ru, name: input.ru, description: input.descriptionRu ?? undefined },
  ];
  if (input.en) entries.push({ locale: Locale.en, name: input.en });
  if (input.kg) entries.push({ locale: Locale.kg, name: input.kg });
  return entries;
};

const getBaseName = (row: ImportRow) => row.product.ruBase ?? row.product.ru;

const getRowMatchInput = (row: ImportRow) => ({
  baseName: getBaseName(row),
  label: row.variant.labelRu,
  attrs: row.variant.attributes && typeof row.variant.attributes === 'object' ? (row.variant.attributes as Record<string, unknown>) : undefined,
});

const shouldUpdateProductName = (currentName: string, nextName: string) => {
  const normalizedCurrent = normalizeWhitespace(currentName).toLowerCase();
  const normalizedNext = normalizeWhitespace(nextName).toLowerCase();
  if (!normalizedNext) return false;
  if (!normalizedCurrent) return true;
  if (normalizedCurrent === normalizedNext) return false;
  const similarity = scoreNameSimilarity(normalizedCurrent, normalizedNext);
  return similarity >= DEFAULT_MATCH_THRESHOLD;
};

const loadProductsForCategory = async (tx: ImportDb, ctx: ImportContext, categoryId: string) => {
  const cached = ctx.productsByCategory.get(categoryId);
  if (cached) return cached;

  const list = await tx.product.findMany({
    where: { categoryId },
    include: { translations: true, variants: { include: { translations: true } } },
  });
  list.forEach((product: any) => {
    ctx.productById.set(product.id, product);
    if (product.slug) ctx.productBySlug.set(product.slug, product);
  });
  ctx.productsByCategory.set(categoryId, list);
  return list;
};

const filterCandidatesByName = (products: any[], baseName: string) => {
  const needle = normalizeWhitespace(baseName).toLowerCase();
  if (!needle || needle.length < 3) return products;
  return products.filter((product) => {
    const name = normalizeWhitespace(getRuName(product)).toLowerCase();
    return name.includes(needle);
  });
};

export const createImportContext = (initialCategorySortOrder: number): ImportContext => ({
  nextCategorySortOrder: initialCategorySortOrder + 1,
  nextProductSortOrders: new Map(),
  categoryCache: new Map(),
  productCache: new Map(),
  productBySlug: new Map(),
  productsByCategory: new Map(),
  variantBySku: new Map(),
  productById: new Map(),
});

const getNextProductSortOrder = async (tx: ImportDb, ctx: ImportContext, categoryId: string) => {
  const cached = ctx.nextProductSortOrders.get(categoryId);
  if (cached) {
    ctx.nextProductSortOrders.set(categoryId, cached + 1);
    return cached;
  }

  if (!tx.product.aggregate) {
    ctx.nextProductSortOrders.set(categoryId, 1 + 1);
    return 1;
  }

  const aggregate = await tx.product.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  const next = (aggregate?._max?.sortOrder ?? 0) + 1;
  ctx.nextProductSortOrders.set(categoryId, next + 1);
  return next;
};

const buildUniqueSlug = async (
  finder: (slug: string) => Promise<{ id: string } | null>,
  baseSlug: string,
  excludeId?: string
) => {
  if (!baseSlug) return undefined;
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const existing = await finder(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmptyScalar = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const mergeAttributes = (
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined
) => {
  if (!incoming) return existing ?? {};
  const base = existing ?? {};
  const merged: Record<string, unknown> = { ...base };

  Object.entries(incoming).forEach(([key, value]) => {
    if (isEmptyScalar(value)) return;
    const current = merged[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      merged[key] = mergeAttributes(current, value);
      return;
    }
    merged[key] = value;
  });

  return merged;
};

const isGeneratedSku = (value?: string | null) => {
  if (!value) return false;
  return normalizeSku(value).startsWith('GEN-');
};

const shouldAssignSku = (
  currentSku: string | null | undefined,
  incomingSku: string,
  skuGenerated: boolean
) => {
  if (!incomingSku || skuGenerated) return false;
  if (!currentSku) return true;
  if (isGeneratedSku(currentSku) && !isGeneratedSku(incomingSku)) return true;
  return false;
};

const estimateImageQuality = (url: string) => {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const keys = ['w', 'width', 'h', 'height', 'size', 'max', 'maxWidth', 'maxHeight'];
    let maxDimension = 0;
    keys.forEach((key) => {
      const value = params.get(key);
      if (!value) return;
      const parsedValue = Number.parseInt(value, 10);
      if (Number.isFinite(parsedValue)) {
        maxDimension = Math.max(maxDimension, parsedValue);
      }
    });

    let score = 0.6;
    if (maxDimension >= 1200) score = 1;
    else if (maxDimension >= 800) score = 0.85;
    else if (maxDimension >= 500) score = 0.7;
    else if (maxDimension > 0) score = 0.4;

    const path = parsed.pathname.toLowerCase();
    if (/(thumb|thumbnail|small|preview|mini|icon)/.test(path)) {
      score -= 0.2;
    }
    if (/(original|large|full|xl|hd)/.test(path)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
};

const shouldUpdateImage = (currentUrl: string | null | undefined, image?: ImportRow['image']) => {
  if (!image?.url) return false;
  if (!currentUrl) return true;
  const currentScore = estimateImageQuality(currentUrl);
  const incomingScore = typeof image.quality === 'number' ? image.quality : estimateImageQuality(image.url);
  return incomingScore > currentScore + 0.05;
};

const buildImageData = (image?: ImportRow['image'], currentUrl?: string | null) => {
  if (!image?.url) return null;
  if (!shouldUpdateImage(currentUrl, image)) return null;
  const updatedAt = image.updatedAt ? new Date(image.updatedAt) : new Date();
  return {
    imageUrl: image.url,
    imageSource: image.source ?? null,
    imageSourceId: image.sourceId ?? null,
    imageUpdatedAt: updatedAt,
  };
};

const ensureCategory = async (
  tx: ImportDb,
  ctx: ImportContext,
  data: ImportRow['category']
): Promise<EnsureResult<any>> => {
  const key = categoryKey(data.ru);
  const cached = ctx.categoryCache.get(key);
  if (cached) return { record: cached, created: false };

  const baseSlug = slugify(data.ru);
  const existingBySlug = baseSlug
    ? await tx.category.findFirst({
        where: { slug: baseSlug },
        include: { translations: true },
      })
    : null;

  const existing =
    existingBySlug ??
    (await tx.category.findFirst({
      where: {
        translations: {
          some: {
            locale: Locale.ru,
            name: { equals: data.ru, mode: 'insensitive' },
          },
        },
      },
      include: { translations: true },
    }));

  if (existing) {
    const existingLocales = new Set(existing.translations.map((t: any) => t.locale));
    const entries = buildLocaleEntries(data).filter((entry) => !existingLocales.has(entry.locale));
    if (entries.length) {
      await Promise.all(
        entries.map((entry) =>
          tx.categoryTranslation.create({
            data: { categoryId: existing.id, locale: entry.locale, name: entry.name },
          })
        )
      );
    }
    if (!existing.slug && baseSlug) {
      const slug = await buildUniqueSlug(
        (value) => tx.category.findFirst({ where: { slug: value }, select: { id: true } }),
        baseSlug,
        existing.id
      );
      if (slug) {
        await tx.category.update({
          where: { id: existing.id },
          data: { slug },
        });
        existing.slug = slug;
      }
    }
    ctx.categoryCache.set(key, existing);
    return { record: existing, created: false };
  }

  const slug = await buildUniqueSlug(
    (value) => tx.category.findFirst({ where: { slug: value }, select: { id: true } }),
    baseSlug
  );

  const created = await tx.category.create({
    data: {
      sortOrder: ctx.nextCategorySortOrder,
      isActive: true,
      slug: slug ?? undefined,
      translations: { create: buildLocaleEntries(data) },
    },
    include: { translations: true },
  });

  ctx.nextCategorySortOrder += 1;
  ctx.categoryCache.set(key, created);
  return { record: created, created: true };
};

const upsertProductTranslations = async (
  tx: ImportDb,
  productId: string,
  data: ImportRow['product']
) => {
  await tx.productTranslation.upsert({
    where: { productId_locale: { productId, locale: Locale.ru } },
    update: {
      name: data.ru,
      description: data.descriptionRu ?? undefined,
    },
    create: {
      productId,
      locale: Locale.ru,
      name: data.ru,
      description: data.descriptionRu ?? undefined,
    },
  });

  if (data.en) {
    await tx.productTranslation.upsert({
      where: { productId_locale: { productId, locale: Locale.en } },
      update: { name: data.en },
      create: { productId, locale: Locale.en, name: data.en },
    });
  }

  if (data.kg) {
    await tx.productTranslation.upsert({
      where: { productId_locale: { productId, locale: Locale.kg } },
      update: { name: data.kg },
      create: { productId, locale: Locale.kg, name: data.kg },
    });
  }
};

const ensureProduct = async (
  tx: ImportDb,
  ctx: ImportContext,
  categoryId: string,
  categoryName: string,
  data: ImportRow['product'],
  productKeyValue: string | undefined,
  image?: ImportRow['image']
): Promise<EnsureResult<any>> => {
  const baseName = data.ru;
  const key = buildProductCacheKey(categoryId, baseName, productKeyValue);
  const cached = ctx.productCache.get(key);
  if (cached) return { record: cached, created: false };

  const baseSlug = productKeyValue || slugify(`${categoryName}-${baseName}`.trim());
  const existingBySlug = baseSlug
    ? await tx.product.findFirst({
        where: { slug: baseSlug },
        include: { translations: true },
      })
    : null;

  const existing =
    existingBySlug ??
    (await tx.product.findFirst({
      where: {
        categoryId,
        translations: {
          some: {
            locale: Locale.ru,
            name: { equals: data.ru, mode: 'insensitive' },
          },
        },
      },
      include: { translations: true },
    }));

  if (existing) {
    await upsertProductTranslations(tx, existing.id, data);
    if (data.descriptionRu) {
      await tx.product.update({
        where: { id: existing.id },
        data: { description: data.descriptionRu },
      });
    }
    const imageData = buildImageData(image, existing.imageUrl);
    if (imageData) {
      await tx.product.update({
        where: { id: existing.id },
        data: imageData,
      });
    }
    if (!existing.slug) {
      const slug = await buildUniqueSlug(
        (value) => tx.product.findFirst({ where: { slug: value }, select: { id: true } }),
        baseSlug,
        existing.id
      );
      if (slug) {
        await tx.product.update({ where: { id: existing.id }, data: { slug } });
        existing.slug = slug;
      }
    }
    ctx.productCache.set(key, existing);
    ctx.productById.set(existing.id, existing);
    if (existing.slug) ctx.productBySlug.set(existing.slug, existing);
    return { record: existing, created: false };
  }

  const slug = await buildUniqueSlug(
    (value) => tx.product.findFirst({ where: { slug: value }, select: { id: true } }),
    baseSlug
  );

  const sortOrder = await getNextProductSortOrder(tx, ctx, categoryId);
  const imageData = buildImageData(image, null);
  const created = await tx.product.create({
    data: {
      categoryId,
      sortOrder,
      description: data.descriptionRu ?? null,
      isActive: true,
      slug: slug ?? undefined,
      ...(imageData ?? {}),
      translations: { create: buildProductTranslationEntries(data) },
    },
    include: { translations: true },
  });

  ctx.productCache.set(key, created);
  ctx.productById.set(created.id, created);
  if (created.slug) ctx.productBySlug.set(created.slug, created);
  return { record: created, created: true };
};

const upsertVariantTranslation = async (tx: ImportDb, variantId: string, label: string) => {
  await tx.variantTranslation.upsert({
    where: { variantId_locale: { variantId, locale: Locale.ru } },
    update: { label },
    create: { variantId, locale: Locale.ru, label },
  });
};

const getProductBySlug = async (tx: ImportDb, ctx: ImportContext, slug: string) => {
  if (!slug) return null;
  const cached = ctx.productBySlug.get(slug);
  if (cached) return cached;
  const product = await tx.product.findFirst({
    where: { slug },
    include: { translations: true, variants: { include: { translations: true } } },
  });
  if (product) {
    ctx.productBySlug.set(slug, product);
    ctx.productById.set(product.id, product);
  }
  return product;
};

const getProductById = async (tx: ImportDb, ctx: ImportContext, id: string) => {
  const cached = ctx.productById.get(id);
  if (cached) return cached;
  const product = await tx.product.findFirst({
    where: { id },
    include: { translations: true, variants: { include: { translations: true } } },
  });
  if (product) {
    ctx.productById.set(product.id, product);
    if (product.slug) ctx.productBySlug.set(product.slug, product);
  }
  return product;
};

const maybeUpdateProduct = async (tx: ImportDb, product: any, row: ImportRow) => {
  const baseName = getBaseName(row);
  const currentName = getRuName(product) || '';

  if (shouldUpdateProductName(currentName, baseName)) {
    await upsertProductTranslations(tx, product.id, { ...row.product, ru: baseName });
  } else if (!currentName) {
    await upsertProductTranslations(tx, product.id, { ...row.product, ru: baseName });
  }

  if (row.product.descriptionRu) {
    await tx.product.update({
      where: { id: product.id },
      data: { description: row.product.descriptionRu },
    });
  }

  const imageData = buildImageData(row.image, product.imageUrl);
  if (imageData) {
    await tx.product.update({
      where: { id: product.id },
      data: imageData,
    });
  }
};

const updateVariantFromRow = async (
  tx: ImportDb,
  variant: any,
  row: ImportRow,
  skuToAssign?: string
) => {
  const existingAttributes = isPlainObject(variant.attributes)
    ? (variant.attributes as Record<string, unknown>)
    : {};
  const attributes = mergeAttributes(existingAttributes, row.variant.attributes);
  const priceWholesale =
    typeof row.variant.priceWholesale === 'number' ? row.variant.priceWholesale : undefined;
  const priceRetail = typeof row.variant.priceRetail === 'number' ? row.variant.priceRetail : row.variant.price;

  const updateData: Record<string, unknown> = {
    price: priceRetail,
    priceRetail,
    attributes,
    isActive: true,
  };
  if (priceWholesale !== undefined) {
    updateData.priceWholesale = priceWholesale;
  }
  if (skuToAssign) {
    updateData.sku = skuToAssign;
  }

  await tx.variant.update({
    where: { id: variant.id },
    data: updateData,
  });

  const label = row.variant.labelRu ?? row.product.ru;
  if (label) {
    await upsertVariantTranslation(tx, variant.id, label);
  }
};

export const upsertImportRow = async (
  tx: ImportDb,
  ctx: ImportContext,
  row: ImportRow
): Promise<{
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message?: string;
  createdIds?: { categoryId?: string; productId?: string; variantId?: string };
}> => {
  if (hasBlockingIssues(row)) {
    return { status: 'skipped', message: 'Row has validation errors.' };
  }

  const baseName = getBaseName(row) || row.product.ru || 'Без названия';
  const categoryName = row.category.ru || 'Без категории';
  const productKeyValue = row.productKey || buildProductKey(categoryName, baseName);
  const matchInput = getRowMatchInput(row);
  const normalizedSku = row.variant.sku ? normalizeSku(row.variant.sku) : '';
  const skuGeneratedIssue =
    row.issues?.some((issue) => issue.code === 'SKU_GENERATED' || issue.code === 'row.sku.generated') ??
    false;
  const skuGenerated = skuGeneratedIssue || isGeneratedSku(normalizedSku);

  const cachedVariant = normalizedSku ? ctx.variantBySku.get(normalizedSku) : null;
  const existingVariant =
    cachedVariant ??
    (normalizedSku
      ? await tx.variant.findUnique({
          where: { sku: normalizedSku },
          include: { product: { include: { translations: true, variants: { include: { translations: true } } } }, translations: true },
        })
      : null);

  if (existingVariant) {
    const skuToAssign = shouldAssignSku(existingVariant.sku, normalizedSku, skuGenerated)
      ? normalizedSku
      : undefined;
    await updateVariantFromRow(tx, existingVariant, row, skuToAssign);
    if (normalizedSku) {
      ctx.variantBySku.set(normalizedSku, existingVariant);
    }
    await maybeUpdateProduct(tx, existingVariant.product, row);
    if (!existingVariant.product.slug && productKeyValue) {
      const slug = await buildUniqueSlug(
        (value) => tx.product.findFirst({ where: { slug: value }, select: { id: true } }),
        productKeyValue,
        existingVariant.productId
      );
      if (slug) {
        await tx.product.update({ where: { id: existingVariant.productId }, data: { slug } });
        existingVariant.product.slug = slug;
        ctx.productBySlug.set(slug, existingVariant.product);
      }
    }
    return { status: 'updated' };
  }

  const categoryResult = await ensureCategory(tx, ctx, row.category);
  const categoryId = categoryResult.record.id;
  const cacheKey = buildProductCacheKey(categoryId, baseName, productKeyValue);

  let resolvedProduct = row.targetProductId
    ? await getProductById(tx, ctx, row.targetProductId)
    : ctx.productCache.get(cacheKey) ?? null;
  if (!resolvedProduct && productKeyValue) {
    resolvedProduct = await getProductBySlug(tx, ctx, productKeyValue);
  }

  if (!resolvedProduct) {
    const candidates = await loadProductsForCategory(tx, ctx, categoryId);
    const filteredCandidates = filterCandidatesByName(candidates, baseName);
    const resolution = resolveProductMatch(filteredCandidates, matchInput);
    if (resolution.ambiguous) {
      return { status: 'skipped', message: 'Ambiguous product match. Needs review.' };
    }
    if (resolution.best) {
      resolvedProduct = resolution.best.product;
    }
  }

  let createdProductId: string | undefined;
  if (resolvedProduct) {
    await maybeUpdateProduct(tx, resolvedProduct, { ...row, product: { ...row.product, ru: baseName } });
    if (!resolvedProduct.slug && productKeyValue) {
      const slug = await buildUniqueSlug(
        (value) => tx.product.findFirst({ where: { slug: value }, select: { id: true } }),
        productKeyValue,
        resolvedProduct.id
      );
      if (slug) {
        await tx.product.update({ where: { id: resolvedProduct.id }, data: { slug } });
        resolvedProduct.slug = slug;
        ctx.productBySlug.set(slug, resolvedProduct);
      }
    }
  } else {
    const productResult = await ensureProduct(
      tx,
      ctx,
      categoryId,
      categoryName,
      { ...row.product, ru: baseName },
      productKeyValue,
      row.image
    );
    resolvedProduct = productResult.record;
    if (productResult.created) {
      createdProductId = productResult.record.id;
      const list = ctx.productsByCategory.get(categoryId);
      if (list) {
        list.push(productResult.record);
      }
    }
  }

  ctx.productCache.set(cacheKey, resolvedProduct);

  const matchedVariant = findVariantMatch(resolvedProduct, matchInput);

  if (matchedVariant) {
    const skuToAssign = shouldAssignSku(matchedVariant.sku, normalizedSku, skuGenerated)
      ? normalizedSku
      : undefined;
    await updateVariantFromRow(tx, matchedVariant, row, skuToAssign);
    if (skuToAssign) {
      ctx.variantBySku.set(skuToAssign, { ...matchedVariant, product: resolvedProduct });
    }
    return {
      status: 'updated',
      createdIds: {
        categoryId: categoryResult.created ? categoryId : undefined,
        productId: createdProductId,
      },
    };
  }

  const unit = matchInput.attrs && typeof matchInput.attrs.unit === 'string' ? matchInput.attrs.unit : undefined;
  const finalSku =
    normalizedSku && !skuGenerated
      ? normalizedSku
      : generateVariantSku({ productKey: productKeyValue, labelRu: row.variant.labelRu, unit });

  const createdVariant = await tx.variant.create({
    data: {
      productId: resolvedProduct.id,
      price: row.variant.priceRetail ?? row.variant.price,
      priceRetail: row.variant.priceRetail ?? row.variant.price,
      priceWholesale: row.variant.priceWholesale ?? null,
      sku: finalSku,
      isActive: true,
      attributes: row.variant.attributes ?? {},
      translations: {
        create: [{ locale: Locale.ru, label: row.variant.labelRu ?? baseName }],
      },
    },
  });

  if (finalSku) {
    ctx.variantBySku.set(finalSku, {
      ...createdVariant,
      product: resolvedProduct,
    });
  }

  return {
    status: 'created',
    createdIds: {
      categoryId: categoryResult.created ? categoryId : undefined,
      productId: createdProductId,
      variantId: createdVariant.id,
    },
  };
};

export const commitImportRows = async (rows: ImportRow[], _priceMode?: PriceMode) => {
  const report: ImportCommitResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    details: [],
    createdEntities: { categories: [], products: [], variants: [] },
  };
  const filteredRows = rows;

  if (!filteredRows.length) {
    return report;
  }

  const maxCategory = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const ctx = createImportContext(maxCategory._max.sortOrder ?? 0);

  const skus = Array.from(
    new Set(
      rows
        .map((row) => (row.variant.sku ? normalizeSku(row.variant.sku) : ''))
        .filter((sku) => sku)
    )
  );
  if (skus.length) {
    const variants = await prisma.variant.findMany({
      where: { sku: { in: skus } },
      include: { product: { include: { translations: true, variants: { include: { translations: true } } } }, translations: true },
    });
    variants.forEach((variant) => {
      if (variant.sku) {
        ctx.variantBySku.set(normalizeSku(variant.sku), variant);
      }
      if (variant.product) {
        ctx.productById.set(variant.product.id, variant.product);
        if (variant.product.slug) ctx.productBySlug.set(variant.product.slug, variant.product);
      }
    });
  }

  const productKeys = Array.from(
    new Set(
      rows
        .map((row) => row.productKey || buildProductKey(row.category.ru || 'Без категории', getBaseName(row)))
        .filter((key) => key)
    )
  );
  if (productKeys.length) {
    const products = await prisma.product.findMany({
      where: { slug: { in: productKeys } },
      include: { translations: true, variants: { include: { translations: true } } },
    });
    products.forEach((product) => {
      if (product.slug) ctx.productBySlug.set(product.slug, product);
      ctx.productById.set(product.id, product);
    });
  }

  const categoryNames = Array.from(
    new Set(rows.map((row) => row.category.ru || 'Без категории').map((name) => normalizeWhitespace(name)))
  ).filter(Boolean);
  if (categoryNames.length) {
    const filters: Prisma.CategoryWhereInput[] = categoryNames.map((name) => ({
      translations: {
        some: {
          locale: Locale.ru,
          name: { equals: name, mode: Prisma.QueryMode.insensitive },
        },
      },
    }));
    const categories = await prisma.category.findMany({
      where: { OR: filters },
      include: { translations: true },
    });
    categories.forEach((category) => {
      const ruName = category.translations.find((translation) => translation.locale === Locale.ru)?.name;
      if (ruName) {
        ctx.categoryCache.set(categoryKey(ruName), category);
      }
    });
  }

  const categoryIds = Array.from(
    new Set(Array.from(ctx.categoryCache.values()).map((category) => category.id))
  );
  if (categoryIds.length) {
    const products = await prisma.product.findMany({
      where: { categoryId: { in: categoryIds } },
      include: { translations: true, variants: { include: { translations: true } } },
    });
    const grouped = new Map<string, any[]>();
    products.forEach((product) => {
      ctx.productById.set(product.id, product);
      if (product.slug) ctx.productBySlug.set(product.slug, product);
      const list = grouped.get(product.categoryId) ?? [];
      list.push(product);
      grouped.set(product.categoryId, list);
    });
    categoryIds.forEach((id) => {
      ctx.productsByCategory.set(id, grouped.get(id) ?? []);
    });
  }

  const chunks = chunkRows(filteredRows, CHUNK_SIZE);

  for (const chunk of chunks) {
    for (const row of chunk) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          return upsertImportRow(tx as unknown as ImportDb, ctx, row);
        });

        report.details.push({
          rowId: row.id,
          sku: row.variant.sku,
          status: result.status,
          message: result.message,
        });

        if (result.status === 'created') report.created += 1;
        else if (result.status === 'updated') report.updated += 1;
        else if (result.status === 'skipped') report.skipped += 1;
        else report.failed += 1;

        if (result.createdIds) {
          if (result.createdIds.categoryId) {
            report.createdEntities?.categories.push(result.createdIds.categoryId);
          }
          if (result.createdIds.productId) {
            report.createdEntities?.products.push(result.createdIds.productId);
          }
          if (result.createdIds.variantId) {
            report.createdEntities?.variants.push(result.createdIds.variantId);
          }
        }
      } catch (error) {
        console.error(error);
        report.failed += 1;
        report.details.push({
          rowId: row.id,
          sku: row.variant.sku,
          status: 'failed',
          message: 'Failed to import row.',
        });
      }
    }
  }

  return report;
};
