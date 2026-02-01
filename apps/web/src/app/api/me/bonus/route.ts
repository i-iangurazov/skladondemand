import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [balance, ledger] = await Promise.all([
    prisma.bonusLedger.aggregate({
      where: { userId: user.id },
      _sum: { delta: true },
    }),
    prisma.bonusLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    balance: balance._sum.delta ?? 0,
    ledger,
  });
}
