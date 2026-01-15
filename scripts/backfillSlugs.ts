import { prisma } from '@qr/db';
import { slugify } from '../apps/web/src/lib/importer/slug';

type Translation = { locale: string; name: string };

const pickName = (translations: Translation[]) => {
  const ru = translations.find((t) => t.locale === 'ru')?.name;
  if (ru) return ru;
  const en = translations.find((t) => t.locale === 'en')?.name;
  if (en) return en;
  return translations[0]?.name ?? '';
};

const buildUniqueSlug = (base: string, used: Set<string>) => {
  let slug = base;
  let suffix = 2;
  while (!slug || used.has(slug)) {
    slug = base ? `${base}-${suffix}` : `item-${suffix}`;
    suffix += 1;
  }
  used.add(slug);
  return slug;
};

const run = async () => {
  const categories = await prisma.category.findMany({
    include: { translations: true },
  });
  const usedCategorySlugs = new Set(categories.map((c) => c.slug).filter(Boolean) as string[]);
  const categorySlugById = new Map<string, string>();

  let categoryUpdates = 0;
  for (const category of categories) {
    if (category.slug) {
      categorySlugById.set(category.id, category.slug);
      continue;
    }
    const name = pickName(category.translations as Translation[]);
    const base = slugify(name) || `category-${category.id.slice(0, 8)}`;
    const slug = buildUniqueSlug(base, usedCategorySlugs);
    await prisma.category.update({ where: { id: category.id }, data: { slug } });
    categorySlugById.set(category.id, slug);
    categoryUpdates += 1;
  }

  const products = await prisma.product.findMany({
    include: { translations: true, category: { include: { translations: true } } },
  });
  const usedProductSlugs = new Set(products.map((p) => p.slug).filter(Boolean) as string[]);

  let productUpdates = 0;
  for (const product of products) {
    if (product.slug) continue;
    const name = pickName(product.translations as Translation[]);
    const categorySlug =
      categorySlugById.get(product.categoryId) ||
      slugify(pickName((product.category?.translations ?? []) as Translation[]));
    const baseSeed = categorySlug ? `${categorySlug}-${name}` : name;
    const base = slugify(baseSeed) || `product-${product.id.slice(0, 8)}`;
    const slug = buildUniqueSlug(base, usedProductSlugs);
    await prisma.product.update({ where: { id: product.id }, data: { slug } });
    productUpdates += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`Backfilled slugs: categories=${categoryUpdates}, products=${productUpdates}`);
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
