import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

const addressSchema = z.object({
  label: z.string().trim().max(60).optional(),
  line1: z.string().trim().max(120).optional(),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().length(2).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const existing = await prisma.address.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.update({
      where: { id: params.id },
      data: {
        label: parsed.data.label?.trim() ?? undefined,
        line1: parsed.data.line1?.trim() ?? undefined,
        line2: parsed.data.line2?.trim() ?? undefined,
        city: parsed.data.city?.trim() ?? undefined,
        region: parsed.data.region?.trim() ?? undefined,
        postalCode: parsed.data.postalCode?.trim() ?? undefined,
        countryCode: parsed.data.countryCode?.toUpperCase() ?? undefined,
        isDefault: parsed.data.isDefault ?? undefined,
      },
    });
  });

  return NextResponse.json({ address: updated });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.address.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.address.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
