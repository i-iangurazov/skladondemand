import { NextResponse } from 'next/server';
import { prisma } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { buildOrderItemsSummary, type OrderLineItem } from '@/lib/notifications/order';

const MAX_TAKE = 200;

type NotificationJob = {
  channel: string;
  status: string;
  lastError: string | null;
  updatedAt: Date;
};

type NotificationSummary = {
  status: 'SENT' | 'FAILED' | 'PENDING';
  lastError: string | null;
  counts: { sent: number; failed: number; pending: number };
};

const summarizeNotifications = (jobs: NotificationJob[]): NotificationSummary => {
  const counts = { sent: 0, failed: 0, pending: 0 };
  jobs.forEach((job) => {
    if (job.status === 'SENT') counts.sent += 1;
    else if (job.status === 'FAILED') counts.failed += 1;
    else counts.pending += 1;
  });

  let status: NotificationSummary['status'] = 'PENDING';
  if (counts.failed > 0) status = 'FAILED';
  else if (counts.pending > 0) status = 'PENDING';
  else if (counts.sent > 0) status = 'SENT';

  const lastError =
    jobs
      .filter((job) => job.lastError)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.lastError ?? null;

  return { status, lastError, counts };
};

const summarizeItems = (items: unknown) => {
  if (!Array.isArray(items)) return '—';
  return buildOrderItemsSummary(items as OrderLineItem[]);
};

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const takeParam = searchParams.get('take');
  const take = takeParam ? Math.min(Math.max(Number(takeParam) || 50, 1), MAX_TAKE) : 50;

  const orders = await prisma.order.findMany({
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, phone: true, address: true } },
      notifications: { select: { channel: true, status: true, lastError: true, updatedAt: true } },
    },
  });

  const payload = orders.map((order) => {
    const telegramJobs = order.notifications.filter((job) => job.channel === 'TELEGRAM');
    const whatsappJobs = order.notifications.filter((job) => job.channel === 'WHATSAPP');

    return {
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      total: order.total,
      itemsSummary: summarizeItems(order.items),
      customer: order.user
        ? { id: order.user.id, name: order.user.name, phone: order.user.phone, address: order.user.address }
        : null,
      notifications: {
        telegram: summarizeNotifications(telegramJobs),
        whatsapp: summarizeNotifications(whatsappJobs),
      },
    };
  });

  return NextResponse.json({ orders: payload });
}
