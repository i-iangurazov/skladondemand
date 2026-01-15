import { NextResponse } from 'next/server';
import { buildClearSessionCookie, getSessionData, revokeSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const session = await getSessionData(request);
  if (session?.token) {
    await revokeSession(session.token);
  }
  const cookie = buildClearSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
