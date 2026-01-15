import { NextResponse } from 'next/server';
import { prisma } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { processNotificationJobs } from '@/lib/notifications/jobs';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
  const orderId = typeof body?.orderId === 'string' ? body.orderId : null;

  if (!orderId) {
    return NextResponse.json({ message: 'orderId is required.' }, { status: 400 });
  }

  const updated = await prisma.orderNotificationJob.updateMany({
    where: { orderId, status: 'FAILED' },
    data: { status: 'PENDING', nextRunAt: new Date(), lastError: null, attempts: 0 },
  });

  const processed = await processNotificationJobs({ orderId });

  return NextResponse.json({ ok: true, updated: updated.count, processed });
}
