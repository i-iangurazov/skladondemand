import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Locale, UserRole } from '@prisma/client';
import { categories, products, variants } from '../../../apps/web/src/lib/avantech/catalog';
import type { LocalizedText } from '../../../apps/web/src/lib/avantech/types';
import { slugify } from '../../../apps/web/src/lib/importer/slug';

const prisma = new PrismaClient();

const locales: Locale[] = [Locale.en, Locale.ru, Locale.kg];

const pickText = (value: LocalizedText, locale: Locale) => value[locale] ?? value.en;

const ADMIN_PHONE_FALLBACK = '+996700000000';
const ADMIN_PASSWORD_FALLBACK = 'Admin123!';

const normalizePhone = (phone: string) => phone.trim();
const phoneRegex = /^\+996\d{9}$/;

const buildProductSortOrders = () => {
  const map = new Map<string, number>();
  categories.forEach((category) => {
    const list = products.filter((product) => product.categoryId === category.id);
    list.forEach((product, index) => {
      map.set(product.id, index);
    });
  });
  return map;
};

const seedCatalog = async () => {
  const productSortOrder = buildProductSortOrders();

  for (const category of categories) {
    const categorySlug = slugify(pickText(category.name, Locale.ru));
    await prisma.category.upsert({
      where: { id: category.id },
      update: { sortOrder: category.sortOrder, isActive: true, slug: categorySlug || undefined },
      create: { id: category.id, sortOrder: category.sortOrder, isActive: true, slug: categorySlug || undefined },
    });

    for (const locale of locales) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale } },
        update: { name: pickText(category.name, locale) },
        create: { categoryId: category.id, locale, name: pickText(category.name, locale) },
      });
    }
  }

  for (const product of products) {
    const category = categories.find((item) => item.id === product.categoryId);
    const categorySlug = category ? slugify(pickText(category.name, Locale.ru)) : '';
    const productSlugBase = `${categorySlug}-${pickText(product.name, Locale.ru)}`.replace(/^-/, '');
    const productSlug = slugify(productSlugBase);
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        categoryId: product.categoryId,
        sortOrder: productSortOrder.get(product.id) ?? 0,
        imageUrl: product.imageUrl ?? null,
        description: product.description ? pickText(product.description, Locale.en) : null,
        isActive: true,
        slug: productSlug || undefined,
      },
      create: {
        id: product.id,
        categoryId: product.categoryId,
        sortOrder: productSortOrder.get(product.id) ?? 0,
        imageUrl: product.imageUrl ?? null,
        description: product.description ? pickText(product.description, Locale.en) : null,
        isActive: true,
        slug: productSlug || undefined,
      },
    });

    for (const locale of locales) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale } },
        update: {
          name: pickText(product.name, locale),
          description: product.description ? pickText(product.description, locale) : null,
        },
        create: {
          productId: product.id,
          locale,
          name: pickText(product.name, locale),
          description: product.description ? pickText(product.description, locale) : null,
        },
      });
    }
  }

  for (const variant of variants) {
    await prisma.variant.upsert({
      where: { id: variant.id },
      update: {
        productId: variant.productId,
        price: variant.price,
        priceRetail: variant.price,
        priceWholesale: null,
        sku: variant.sku ?? null,
        isActive: variant.isActive,
        attributes: variant.attributes ?? {},
      },
      create: {
        id: variant.id,
        productId: variant.productId,
        price: variant.price,
        priceRetail: variant.price,
        priceWholesale: null,
        sku: variant.sku ?? null,
        isActive: variant.isActive,
        attributes: variant.attributes ?? {},
      },
    });

    for (const locale of locales) {
      await prisma.variantTranslation.upsert({
        where: { variantId_locale: { variantId: variant.id, locale } },
        update: { label: pickText(variant.label, locale) },
        create: { variantId: variant.id, locale, label: pickText(variant.label, locale) },
      });
    }
  }
};

const seedAdmin = async () => {
  const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? ADMIN_PHONE_FALLBACK);
  if (!phoneRegex.test(phone)) {
    throw new Error(`SEED_ADMIN_PHONE must match +996XXXXXXXXX format. Received: ${phone}`);
  }
  const password = process.env.SEED_ADMIN_PASSWORD ?? ADMIN_PASSWORD_FALLBACK;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { phone },
    update: {
      name: 'Admin',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      phone,
      name: 'Admin',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  return { phone, password };
};

const main = async () => {
  await seedCatalog();
  const admin = await seedAdmin();
  return admin;
};

main()
  .then((admin) => {
    // eslint-disable-next-line no-console
    console.log(`Seed complete. Admin phone: ${admin.phone}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      // eslint-disable-next-line no-console
      console.log(`Default admin password: ${ADMIN_PASSWORD_FALLBACK}`);
    }
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
