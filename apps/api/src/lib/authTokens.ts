import { UserRoleEnum } from '@qr/types';
import {
  platformJwtSecret,
  platformTokenTtlSeconds,
  staffJwtSecret,
  staffTokenTtlSeconds,
} from '../config/env';
import { base64UrlEncode, signSegment } from './crypto';

const ISSUER = 'qr-api';

export type StaffTokenPayload = {
  sub: string;
  role: (typeof UserRoleEnum)['enum'][keyof typeof UserRoleEnum['enum']];
  venueId?: string;
  aud: 'staff';
  exp: number;
  iss?: string;
};

export type PlatformTokenPayload = {
  sub: string;
  role: (typeof UserRoleEnum)['enum'][keyof typeof UserRoleEnum['enum']];
  venueId?: string;
  aud: 'platform';
  exp: number;
  iss?: string;
};

const signJwt = (
  payload: Record<string, unknown>,
  secret: string,
  expSeconds: number,
  aud: StaffTokenPayload['aud'] | PlatformTokenPayload['aud']
) => {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode({
    ...payload,
    aud,
    iss: ISSUER,
    exp: (payload as { exp?: number }).exp ?? Math.floor(Date.now() / 1000) + expSeconds,
  });
  const signature = signSegment(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
};

const verifyJwt = <T extends { exp?: number; aud?: string }>(token: string | undefined, secret: string, expectedAud: string): T | null => {
  if (!token) return null;
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) return null;
  const expected = signSegment(`${header}.${body}`, secret);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!Buffer.from(signature).equals(Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if ((payload as { aud?: string }).aud !== expectedAud) return null;
  return payload;
};

export const signStaffJwt = (payload: Omit<StaffTokenPayload, 'exp' | 'aud'> & { exp?: number }) =>
  signJwt(payload, staffJwtSecret, staffTokenTtlSeconds, 'staff');

export const verifyStaffJwt = (token?: string): StaffTokenPayload | null => verifyJwt<StaffTokenPayload>(token, staffJwtSecret, 'staff');

export const issueStaffAccessToken = (staff: { id: string; role: StaffTokenPayload['role']; venueId?: string }) =>
  signStaffJwt({ sub: staff.id, role: staff.role, venueId: staff.venueId });

export const signPlatformJwt = (payload: Omit<PlatformTokenPayload, 'exp' | 'aud'> & { exp?: number }) =>
  signJwt(payload, platformJwtSecret, platformTokenTtlSeconds, 'platform');

export const verifyPlatformJwt = (token?: string): PlatformTokenPayload | null =>
  verifyJwt<PlatformTokenPayload>(token, platformJwtSecret, 'platform');

export const issuePlatformAccessToken = (user: { id: string; role: PlatformTokenPayload['role']; venueId?: string }) =>
  signPlatformJwt({ sub: user.id, role: user.role, venueId: user.venueId });

export const parseBearerToken = (header: string | undefined) => {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  return token;
};
