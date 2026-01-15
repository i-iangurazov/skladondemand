import crypto from 'node:crypto';
import { hashToken, hashPassword, verifyPassword, isPasswordStrong } from './crypto';
import { refreshTokenTtlDays } from '../config/env';
import { PlatformUserDto, UserRoleEnum } from '@qr/types';

export const mapPlatformUser = (u: any) =>
  PlatformUserDto.parse({
    id: u.id,
    email: u.email,
    name: u.name ?? undefined,
    role: u.role,
    venueId: u.venueId ?? undefined,
    isActive: u.isActive ?? true,
  });

export const createPlatformService = (prisma: any) => {
  const createRefreshSession = async (userId: string) => {
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    await prisma.platformSession.create({ data: { userId, tokenHash, expiresAt } });
    return { refreshToken: raw, expiresAt };
  };

  const revokeRefreshSession = async (token?: string) => {
    if (!token) return;
    const tokenHash = hashToken(token);
    await prisma.platformSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date().toISOString() } });
  };

  const findRefreshSession = async (token?: string) => {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await prisma.platformSession.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } });
    return session;
  };

  const ensureOwnerUser = async (email: string, password: string) => {
    if (!isPasswordStrong(password)) {
      throw new Error('Platform owner password must be at least 8 chars with upper/lowercase and a number.');
    }
    const passwordHash = await hashPassword(password);
    return prisma.platformUser.upsert({
      where: { email },
      update: { passwordHash, role: UserRoleEnum.enum.PLATFORM_OWNER, isActive: true },
      create: {
        email,
        passwordHash,
        role: UserRoleEnum.enum.PLATFORM_OWNER,
        isActive: true,
        name: 'Platform Owner',
      },
    });
  };

  const verifyUserPassword = async (user: any, password: string) => {
    if (!user?.passwordHash) return false;
    return verifyPassword(password, user.passwordHash);
  };

  return {
    createRefreshSession,
    revokeRefreshSession,
    findRefreshSession,
    ensureOwnerUser,
    verifyUserPassword,
  };
};
