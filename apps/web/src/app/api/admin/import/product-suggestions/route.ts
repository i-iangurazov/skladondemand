import { NextResponse } from 'next/server';
import { prisma, Locale } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { normalizeWhitespace } from '@/lib/importer/normalize';
import { slugify } from '@/lib/importer/slug';
import { getRuName, resolveProductMatch } from '@/lib/importer/resolver';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const MAX_CANDIDATES = 8;
const MIN_SCORE = 0.35;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit({
    key: `import:product-suggestions:${auth.user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { code: 'errors.rateLimited' },
      {
        status: 429,
        headers: { 'Retry-After': Math.ceil(rate.retryAfterMs / 1000).toString() },
      }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.categoryRu !== 'string' || typeof body.baseNameRu !== 'string') {
    return NextResponse.json({ code: 'errors.invalidPayload' }, { status: 400 });
  }

  const categoryRu = normalizeWhitespace(body.categoryRu);
  const baseNameRu = normalizeWhitespace(body.baseNameRu);
  if (!categoryRu || !baseNameRu) {
    return NextResponse.json({ candidates: [], ambiguous: false, potentialDuplicate: false });
  }

  const categorySlug = slugify(categoryRu);
  const category = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: categorySlug },
        {
          translations: {
            some: {
              locale: Locale.ru,
              name: { equals: categoryRu, mode: 'insensitive' },
            },
          },
        },
      ],
    },
  });

  if (!category) {
    return NextResponse.json({ candidates: [], ambiguous: false, potentialDuplicate: false });
  }

  const products = await prisma.product.findMany({
    where: {
      categoryId: category.id,
      translations: {
        some: {
          locale: Locale.ru,
          name: { contains: baseNameRu, mode: 'insensitive' },
        },
      },
    },
    include: { translations: true, variants: { include: { translations: true } } },
    take: 50,
  });

  const resolution = resolveProductMatch(products, { baseName: baseNameRu });
  const candidates = resolution.matches
    .filter((match) => match.score >= MIN_SCORE)
    .slice(0, MAX_CANDIDATES)
    .map((match) => ({
      id: match.product.id,
      name: getRuName(match.product) || baseNameRu,
      slug: match.product.slug ?? undefined,
      score: match.score,
    }));

  const ambiguous = resolution.ambiguous;
  const potentialDuplicate = !ambiguous && resolution.eligible.length > 1;

  return NextResponse.json({ candidates, ambiguous, potentialDuplicate });
}
