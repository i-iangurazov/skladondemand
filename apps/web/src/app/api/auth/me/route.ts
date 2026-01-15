import { NextResponse } from 'next/server';
import { prisma } from '@qr/db';
import { buildClearSessionCookie, buildSessionCookie, getSessionData } from '@/lib/auth/session';
import { toAuthUser } from '@/lib/auth/user';

const SESSION_TTL_DAYS = 180;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * SESSION_TTL_DAYS;
const REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 30;

export async function GET(request: Request) {
  try {
    const data = await getSessionData(request);
    if (!data) {
      const response = NextResponse.json({ code: 'errors.unauthorized' }, { status: 401 });
      const cookie = buildClearSessionCookie();
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    const response = NextResponse.json({ user: toAuthUser(data.user) });

    if (data.session.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await prisma.session.update({ where: { id: data.session.id }, data: { expiresAt } });
      const cookie = buildSessionCookie(data.token);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch {
    return NextResponse.json({ code: 'errors.generic' }, { status: 500 });
  }
}
