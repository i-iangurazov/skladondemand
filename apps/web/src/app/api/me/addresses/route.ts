import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

const addressSchema = z.object({
  label: z.string().trim().max(60).optional(),
  line1: z.string().trim().max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20),
  countryCode: z.string().trim().length(2),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const data = parsed.data;
  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        userId: user.id,
        label: data.label?.trim() || null,
        line1: data.line1.trim(),
        line2: data.line2?.trim() || null,
        city: data.city.trim(),
        region: data.region?.trim() || null,
        postalCode: data.postalCode.trim(),
        countryCode: data.countryCode.toUpperCase(),
        isDefault: Boolean(data.isDefault),
      },
    });
  });

  return NextResponse.json({ address: created });
}
