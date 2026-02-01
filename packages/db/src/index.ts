import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export { Prisma, PrismaClient };
export type * from '@prisma/client';
