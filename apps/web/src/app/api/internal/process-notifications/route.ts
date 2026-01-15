import { NextResponse } from 'next/server';
import { processNotificationJobs } from '@/lib/notifications/jobs';

const INTERNAL_HEADER = 'x-internal-secret';

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ message: 'INTERNAL_SECRET is not configured.' }, { status: 500 });
  }

  const provided = request.headers.get(INTERNAL_HEADER);
  if (!provided || provided !== expectedSecret) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    limit?: number;
    orderId?: string;
  } | null;

  const limit = typeof body?.limit === 'number' && body.limit > 0 ? body.limit : undefined;
  const orderId = typeof body?.orderId === 'string' ? body.orderId : undefined;

  const result = await processNotificationJobs({ limit, orderId });
  return NextResponse.json({ ok: true, ...result });
}
