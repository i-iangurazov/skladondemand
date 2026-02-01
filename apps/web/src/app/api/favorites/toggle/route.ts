import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

const schema = z.object({
  productHandle: z.string().trim().min(1).max(128),
});

const normalizeHandle = (value: string) => value.trim().toLowerCase();

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const handle = normalizeHandle(parsed.data.productHandle);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.favorite.findUnique({
      where: { userId_productHandle: { userId: user.id, productHandle: handle } },
      select: { id: true },
    });
    if (existing) {
      await tx.favorite.delete({
        where: { userId_productHandle: { userId: user.id, productHandle: handle } },
      });
      return { favorited: false };
    }
    await tx.favorite.create({
      data: { userId: user.id, productHandle: handle },
    });
    return { favorited: true };
  });

  return NextResponse.json(result);
}
