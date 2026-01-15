import { NextResponse } from 'next/server';
import { prisma, Locale } from '@qr/db';
import { isLanguage } from '@/lib/i18n';

type Translation = { locale: Locale } & Record<string, unknown>;

const pickTranslation = <T extends Translation>(translations: T[], locale: Locale): T | undefined =>
  translations.find((t) => t.locale === locale) ??
  translations.find((t) => t.locale === Locale.ru) ??
  translations.find((t) => t.locale === Locale.en);

const normalizeAttributes = (value: unknown): Record<string, string | number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, string | number>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get('locale');
  const locale = isLanguage(localeParam) ? (localeParam as Locale) : Locale.en;

  const translationLocales = Array.from(new Set([locale, Locale.ru, Locale.en]));

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      translations: { where: { locale: { in: translationLocales } } },
      products: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          translations: { where: { locale: { in: translationLocales } } },
          variants: {
            where: { isActive: true },
            orderBy: { id: 'asc' },
            include: { translations: { where: { locale: { in: translationLocales } } } },
          },
        },
      },
    },
  });

  const payload = categories.map((category) => {
    const categoryTranslation = pickTranslation(category.translations, locale);
    return {
      id: category.id,
      sortOrder: category.sortOrder,
      name: categoryTranslation?.name ?? category.id,
      products: category.products.map((product) => {
        const productTranslation = pickTranslation(product.translations, locale);
        return {
          id: product.id,
          categoryId: product.categoryId,
          sortOrder: product.sortOrder,
          name: productTranslation?.name ?? product.id,
          description: productTranslation?.description ?? null,
          imageUrl: product.imageUrl,
          variants: product.variants.map((variant) => {
            const variantTranslation = pickTranslation(variant.translations, locale);
            return {
              id: variant.id,
              productId: variant.productId,
              label: variantTranslation?.label ?? variant.id,
              price: variant.price,
              sku: variant.sku,
              attributes: normalizeAttributes(variant.attributes),
              isActive: variant.isActive,
            };
          }),
        };
      }),
    };
  });

  return NextResponse.json({ categories: payload });
}
