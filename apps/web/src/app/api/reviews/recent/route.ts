import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
  }

  const limit = parsed.data.limit ?? 10;
  const items = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ items });
}
