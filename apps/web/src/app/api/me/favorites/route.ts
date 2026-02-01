import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

const schema = z.object({
  productHandle: z.string().trim().max(120),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const normalizedHandle = parsed.data.productHandle.trim().toLowerCase();

  const favorite = await prisma.favorite.upsert({
    where: { userId_productHandle: { userId: user.id, productHandle: normalizedHandle } },
    update: {},
    create: { userId: user.id, productHandle: normalizedHandle },
  });

  return NextResponse.json({ favorite });
}
