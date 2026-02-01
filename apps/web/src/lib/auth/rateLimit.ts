import 'server-only';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

export const getClientIp = (request: Request) => {
  const header = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';
  return header.split(',')[0]?.trim() || 'unknown';
};

export const checkRateLimit = (key: string) => {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.max(0, entry.resetAt - now) };
  }
  entry.count += 1;
  store.set(key, entry);
  return { ok: true };
};
