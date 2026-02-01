import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { signSession, setSessionCookie } from '@/lib/auth/jwt';
import { checkRateLimit, getClientIp } from '@/lib/auth/rateLimit';

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`register:${ip}`);
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: parsed.data.firstName?.trim() || null,
        lastName: parsed.data.lastName?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        bonusLedger: {
          create: {
            delta: 100,
            reason: 'welcome',
          },
        },
      },
      select: { id: true, email: true },
    });

    const token = await signSession({ sub: user.id, email: user.email });
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (message.includes('Unique constraint') || message.includes('unique')) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
  }
}
