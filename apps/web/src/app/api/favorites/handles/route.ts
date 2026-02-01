import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items: Array<{ productHandle: string }> = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { productHandle: true },
  });
  const handles = items.map((item) => item.productHandle);

  return NextResponse.json({ handles });
}
