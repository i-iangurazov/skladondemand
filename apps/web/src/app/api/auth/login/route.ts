import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@qr/db';
import { isValidPhone } from '@/lib/auth/validation';
import { buildSessionCookie, createSession } from '@/lib/auth/session';
import { toAuthUser } from '@/lib/auth/user';
import { checkRateLimit } from '@/lib/rateLimit';

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const PASSWORD_MIN_LENGTH = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    const ip = getClientIp(request);

    if (!parsed.success) {
      const limit = checkRateLimit({ key: `login:${ip}`, limit: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS });
      if (!limit.ok) {
        return NextResponse.json(
          { code: 'errors.rateLimited', retryAfterMs: limit.retryAfterMs },
          {
            status: 429,
            headers: { 'Retry-After': Math.ceil(limit.retryAfterMs / 1000).toString() },
          }
        );
      }
      return NextResponse.json({ code: 'errors.invalidCredentials' }, { status: 400 });
    }

    const phone = parsed.data.phone.trim();
    const password = parsed.data.password.trim();

    const limit = checkRateLimit({
      key: `login:${ip}:${phone}`,
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { code: 'errors.rateLimited', retryAfterMs: limit.retryAfterMs },
        {
          status: 429,
          headers: { 'Retry-After': Math.ceil(limit.retryAfterMs / 1000).toString() },
        }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ code: 'avantech.auth.invalidPhone' }, { status: 400 });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ code: 'errors.invalidCredentials' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      return NextResponse.json({ code: 'errors.invalidCredentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ code: 'errors.invalidCredentials' }, { status: 401 });
    }

    const { token } = await createSession(user.id);
    const response = NextResponse.json({ user: toAuthUser(user) });
    const cookie = buildSessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ code: 'errors.generic' }, { status: 500 });
  }
}
