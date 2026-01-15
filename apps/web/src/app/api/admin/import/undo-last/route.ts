import { NextResponse } from 'next/server';
import { prisma, ImportJobStatus } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { checkRateLimit } from '@/lib/rateLimit';
import { logAdminAction } from '@/lib/audit';

export const runtime = 'nodejs';

type CreatedEntities = {
  categories?: string[];
  products?: string[];
  variants?: string[];
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit({
    key: `import:undo:${auth.user.id}`,
    limit: 2,
    windowMs: 60 * 60 * 1000,
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
  const importId = typeof body?.importId === 'string' ? body.importId : undefined;
  if (body?.importId && typeof body.importId !== 'string') {
    return NextResponse.json({ code: 'errors.invalidPayload' }, { status: 400 });
  }

  const job = importId
    ? await prisma.importJob.findUnique({ where: { id: importId } })
    : await prisma.importJob.findFirst({
        where: { status: ImportJobStatus.COMMITTED },
        orderBy: { createdAt: 'desc' },
      });

  if (!job) {
    return NextResponse.json({ code: 'errors.importNotFound' }, { status: 404 });
  }

  if (job.status !== ImportJobStatus.COMMITTED) {
    return NextResponse.json({ code: 'errors.importNotCommitted' }, { status: 409 });
  }

  const createdEntities = (job.reportJson as { createdEntities?: CreatedEntities } | null)?.createdEntities;
  const categories = createdEntities?.categories ?? [];
  const products = createdEntities?.products ?? [];
  const variants = createdEntities?.variants ?? [];

  if (!categories.length && !products.length && !variants.length) {
    return NextResponse.json({ code: 'errors.importUndoUnavailable' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (variants.length) {
      await tx.variant.updateMany({
        where: { id: { in: variants } },
        data: { isActive: false },
      });
    }
    if (products.length) {
      await tx.product.updateMany({
        where: { id: { in: products } },
        data: { isActive: false },
      });
    }
    if (categories.length) {
      await tx.category.updateMany({
        where: { id: { in: categories } },
        data: { isActive: false },
      });
    }

    await tx.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.UNDONE,
        reportJson: {
          ...(job.reportJson && typeof job.reportJson === 'object' && !Array.isArray(job.reportJson)
            ? job.reportJson
            : {}),
          undoneAt: new Date().toISOString(),
        },
      },
    });
  });

  await logAdminAction({
    userId: auth.user.id,
    action: 'import.undo',
    importJobId: job.id,
    metadata: {
      categories: categories.length,
      products: products.length,
      variants: variants.length,
    },
  });

  return NextResponse.json({
    importId: job.id,
    reverted: {
      categories: categories.length,
      products: products.length,
      variants: variants.length,
    },
  });
}
