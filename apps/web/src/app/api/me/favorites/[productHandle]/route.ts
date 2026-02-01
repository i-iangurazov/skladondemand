import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

export async function DELETE(_: Request, { params }: { params: { productHandle: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const normalizedHandle = params.productHandle.trim().toLowerCase();
  await prisma.favorite.deleteMany({
    where: { userId: user.id, productHandle: normalizedHandle },
  });

  return NextResponse.json({ ok: true });
}
