import crypto from 'node:crypto';

type PrismaClient = {
  idempotencyKey: {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
};

export const getIdempotencyKey = (req: { headers?: Record<string, any> }) =>
  (req.headers?.['idempotency-key'] as string | undefined) || (req.headers?.['Idempotency-Key'] as string | undefined);

export const computeRequestHash = (payload: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');

type IdempotencyOptions = {
  scope: string;
  key: string;
  requestHash: string;
  ttlSeconds?: number;
  metadata?: {
    venueId?: string;
    tableId?: string;
    staffUserId?: string;
    sessionId?: string;
  };
};

export const withIdempotency = async <T>(
  prisma: PrismaClient,
  opts: IdempotencyOptions,
  handler: () => Promise<{ statusCode: number; body: T }>
): Promise<{ statusCode: number; body: T; replay: boolean }> => {
  const runWithoutStore = async () => {
    const result = await handler();
    return { ...result, replay: false };
  };

  const ttl = opts.ttlSeconds ?? 60 * 10;
  const now = Date.now();
  const expiresAt = new Date(now + ttl * 1000);
  const uniqueKey = { scope_key: { scope: opts.scope, key: opts.key } };
  let existing;
  try {
    existing = await prisma.idempotencyKey.findUnique({ where: uniqueKey });
  } catch (err: any) {
    if (err?.code === 'P2021') return runWithoutStore();
    throw err;
  }
  if (existing) {
    if (existing.requestHash !== opts.requestHash) {
      throw Object.assign(new Error('Idempotency key collision'), { statusCode: 409 });
    }
    const notExpired = !existing.expiresAt || existing.expiresAt > new Date();
    if (existing.responseJson && notExpired) {
      return { statusCode: existing.statusCode ?? 200, body: existing.responseJson as T, replay: true };
    }
    if (!existing.responseJson && notExpired) {
      throw Object.assign(new Error('Idempotent request in progress'), { statusCode: 409 });
    }
  } else {
    try {
      await prisma.idempotencyKey.create({
        data: {
          scope: opts.scope,
          key: opts.key,
          requestHash: opts.requestHash,
          expiresAt,
          venueId: opts.metadata?.venueId,
          tableId: opts.metadata?.tableId,
          staffUserId: opts.metadata?.staffUserId,
          sessionId: opts.metadata?.sessionId,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2021') return runWithoutStore();
      const collision = await prisma.idempotencyKey.findUnique({ where: uniqueKey });
      if (collision?.requestHash !== opts.requestHash) {
        throw Object.assign(new Error('Idempotency key collision'), { statusCode: 409 });
      }
      const notExpired = !collision?.expiresAt || (collision?.expiresAt as Date) > new Date();
      if (collision?.responseJson && notExpired) {
        return { statusCode: collision.statusCode ?? 200, body: collision.responseJson as T, replay: true };
      }
      if (collision && notExpired) {
        throw Object.assign(new Error('Idempotent request in progress'), { statusCode: 409 });
      }
      existing = collision;
    }
  }

  const result = await handler();

  try {
    await prisma.idempotencyKey.update({
      where: uniqueKey,
      data: { responseJson: result.body as any, statusCode: result.statusCode, requestHash: opts.requestHash, expiresAt },
    });
  } catch (err: any) {
    if (err?.code === 'P2021') {
      return { ...result, replay: false };
    }
    // ignore write failures
  }

  return { ...result, replay: false };
};
