import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'skladon_session';
const JWT_TTL_SECONDS = 60 * 60 * 24 * 30;

const getSecret = () => {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not configured.');
  }
  return new TextEncoder().encode(secret);
};

export type SessionPayload = {
  sub: string;
  email: string;
};

export const signSession = async (payload: SessionPayload) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_TTL_SECONDS)
    .sign(getSecret());
};

export const verifySession = async (token: string): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
};

export const getSessionFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
};

export const setSessionCookie = (response: { cookies: { set: (args: unknown) => void } }, token: string) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: JWT_TTL_SECONDS,
  });
};

export const clearSessionCookie = (response: { cookies: { set: (args: unknown) => void } }) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
};
