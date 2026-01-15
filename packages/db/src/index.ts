import {
  Prisma,
  PrismaClient,
  Locale,
  UserRole,
  ImportSourceType,
  ImportJobStatus,
  ImportRowStatus,
} from '@prisma/client';

export const prisma = new PrismaClient();
export { Prisma, PrismaClient, Locale, UserRole, ImportSourceType, ImportJobStatus, ImportRowStatus };
export type * from '@prisma/client';
