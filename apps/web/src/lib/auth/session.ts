import 'server-only';

import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@qr/db';

const SESSION_COOKIE = 'session';
const SESSION_TTL_DAYS = 180;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * SESSION_TTL_DAYS;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

const parseCookieHeader = (header: string | null) => {
  if (!header) return {} as Record<string, string>;
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const getSessionToken = async (request?: Request) => {
  if (request) {
    const cookieHeader = request.headers.get('cookie');
    const parsed = parseCookieHeader(cookieHeader);
    return parsed[SESSION_COOKIE] ?? null;
  }
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
};

export const buildSessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  },
});

export const buildClearSessionCookie = () => ({
  name: SESSION_COOKIE,
  value: '',
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  },
});

export const createSession = async (userId: string) => {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, session };
};

export const revokeSession = async (token: string) => {
  const tokenHash = hashSessionToken(token);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const getSessionData = async (request?: Request) => {
  const token = await getSessionToken(request);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
  if (!session || !session.user.isActive) return null;
  return { session, user: session.user, token };
};

export const getSessionUser = async (request?: Request) => {
  const data = await getSessionData(request);
  return data?.user ?? null;
};

export { hashSessionToken };
