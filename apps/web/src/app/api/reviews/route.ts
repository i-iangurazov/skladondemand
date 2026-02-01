import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

const getSchema = z.object({
  productHandle: z.string().trim().max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().max(200).optional(),
});

const postSchema = z.object({
  productHandle: z.string().trim().max(120),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(3).max(2000),
});

const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.toISOString()}::${id}`).toString('base64');

const decodeCursor = (cursor: string) => {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [date, id] = decoded.split('::');
    if (!date || !id) return null;
    const createdAt = new Date(date);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = getSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
  }

  const { productHandle, limit = 10, cursor } = parsed.data;
  const cursorData = cursor ? decodeCursor(cursor) : null;

  const where = cursorData
    ? {
        productHandle,
        OR: [
          { createdAt: { lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, id: { lt: cursorData.id } },
        ],
      }
    : { productHandle };

  const items = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore
    ? encodeCursor(pageItems[pageItems.length - 1].createdAt, pageItems[pageItems.length - 1].id)
    : null;

  const summary = await prisma.review.aggregate({
    where: { productHandle },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return NextResponse.json({
    items: pageItems,
    nextCursor,
    summary: {
      avg: summary._avg.rating ?? 0,
      count: summary._count.rating ?? 0,
    },
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const authorName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        userId: user.id,
        productHandle: parsed.data.productHandle,
        rating: parsed.data.rating,
        title: parsed.data.title?.trim() || null,
        body: parsed.data.body.trim(),
        authorName,
        authorEmail: user.email,
        source: 'user',
      },
    });

    await tx.bonusLedger.create({
      data: {
        userId: user.id,
        delta: 5,
        reason: 'review',
      },
    });

    return review;
  });

  return NextResponse.json({ review: result });
}
