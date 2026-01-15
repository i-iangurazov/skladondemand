import crypto from 'node:crypto';
import { StaffUserDto, UserRoleEnum, type StaffUser } from '@qr/types';
import { hashToken, generateTempPassword, hashPassword } from './crypto';
import {
  refreshCookieDomain,
  refreshCookieName,
  refreshCookiePath,
  refreshCookieSameSite,
  refreshCookieSecure,
  refreshTokenTtlDays,
  DEMO_STAFF_PASSWORD,
} from '../config/env';

export const mapStaffUser = (u: any) =>
  StaffUserDto.parse({
    id: u.id,
    venueId: u.venueId,
    role: u.role,
    name: u.name,
    phone: u.phone ?? undefined,
    email: u.email ?? undefined,
    isActive: u.isActive ?? true,
  });

export const createStaffService = (prisma: any) => {
  const createRefreshSession = async (userId: string) => {
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    await prisma.staffSession.create({ data: { userId, tokenHash, expiresAt } });
    return { refreshToken: raw, expiresAt };
  };

  const revokeRefreshSession = async (token?: string) => {
    if (!token) return;
    const tokenHash = hashToken(token);
    await prisma.staffSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date().toISOString() } });
  };

  const findRefreshSession = async (token?: string) => {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await prisma.staffSession.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } });
    return session;
  };

  const ensureDemoStaffUsers = async (venueId: string) => {
    const roles: StaffUser['role'][] = [
      UserRoleEnum.enum.ADMIN,
      UserRoleEnum.enum.WAITER,
      UserRoleEnum.enum.KITCHEN,
    ];
    const passwordHash = await hashPassword(DEMO_STAFF_PASSWORD);
    await Promise.all(
      roles.map((role) =>
        prisma.staffUser.upsert({
          where: { email: `${role.toLowerCase()}@example.com` },
          update: { venueId, role, name: `${role.toLowerCase()} demo`, passwordHash, isActive: true },
          create: {
            id: `staff-${role.toLowerCase()}`,
            venueId,
            role,
            name: `${role.toLowerCase()} demo`,
            email: `${role.toLowerCase()}@example.com`,
            passwordHash,
            isActive: true,
          },
        })
      )
    );
  };

  return {
    createRefreshSession,
    revokeRefreshSession,
    findRefreshSession,
    ensureDemoStaffUsers,
  };
};

// Helpers to share cookie configuration
export const refreshCookieOptions = {
  name: refreshCookieName,
  secure: refreshCookieSecure,
  domain: refreshCookieDomain,
  path: refreshCookiePath,
  sameSite: refreshCookieSameSite,
};
