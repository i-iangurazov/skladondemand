import { prisma } from '@qr/db';

type AuditInput = {
  userId: string;
  action: string;
  importJobId?: string;
  metadata?: Record<string, unknown>;
};

export const logAdminAction = async ({ userId, action, importJobId, metadata }: AuditInput) => {
  try {
    await prisma.importAuditLog.create({
      data: {
        userId,
        action,
        importJobId,
        metadata,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
};
