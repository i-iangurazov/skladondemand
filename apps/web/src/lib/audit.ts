import { prisma, Prisma } from '@qr/db';

type AuditInput = {
  userId: string;
  action: string;
  importJobId?: string;
  metadata?: Record<string, unknown>;
};

export const logAdminAction = async ({ userId, action, importJobId, metadata }: AuditInput) => {
  try {
    const sanitizedMetadata = metadata
      ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue)
      : undefined;
    await prisma.importAuditLog.create({
      data: {
        userId,
        action,
        importJobId,
        metadata: sanitizedMetadata,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
};
