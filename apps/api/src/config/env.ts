import path from 'node:path';
import dotenv from 'dotenv';

// Load root env for API and Prisma. Use project root .env by default.
const envPath = process.env.ENV_PATH || path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath, override: true });

export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
export const SESSION_INACTIVITY_MS = Number(process.env.SESSION_INACTIVITY_MS ?? 90 * 60 * 1000);
export const CLOSED_SESSION_TTL_MS = Number(process.env.CLOSED_SESSION_TTL_MS ?? 24 * 60 * 60 * 1000);
export const SERVED_ORDER_TTL_MS = Number(process.env.SERVED_ORDER_TTL_MS ?? 24 * 60 * 60 * 1000);
const defaultJwtSecret = process.env.API_JWT_SECRET || 'dev-secret';
export const staffJwtSecret = process.env.API_JWT_SECRET_STAFF || defaultJwtSecret;
export const platformJwtSecret = process.env.API_JWT_SECRET_PLATFORM || defaultJwtSecret;
export const DEMO_STAFF_PASSWORD = process.env.STAFF_DEMO_PASSWORD || 'ChangeMe123!';
// Access tokens live for one day by default
export const staffTokenTtlSeconds = Number(process.env.STAFF_TOKEN_TTL_SECONDS ?? 24 * 60 * 60);
export const platformTokenTtlSeconds = Number(process.env.PLATFORM_TOKEN_TTL_SECONDS ?? staffTokenTtlSeconds);
export const refreshTokenTtlDays = Number(process.env.REFRESH_COOKIE_MAX_AGE_DAYS ?? process.env.STAFF_REFRESH_TOKEN_TTL_DAYS ?? 14);
export const refreshCookieName = process.env.REFRESH_COOKIE_NAME || process.env.STAFF_REFRESH_COOKIE_NAME || 'qr_staff_r';
export const refreshCookiePath = process.env.REFRESH_COOKIE_PATH || process.env.STAFF_REFRESH_COOKIE_PATH || '/auth';
export const refreshCookieSameSite =
  ((process.env.REFRESH_COOKIE_SAMESITE || process.env.STAFF_REFRESH_COOKIE_SAMESITE) as 'lax' | 'strict' | 'none' | undefined) ?? 'lax';
const frontendHost = (() => {
  try {
    return new URL(FRONTEND_BASE_URL).hostname;
  } catch {
    return undefined;
  }
})();
export const refreshCookieDomain = process.env.REFRESH_COOKIE_DOMAIN || process.env.STAFF_REFRESH_COOKIE_DOMAIN || frontendHost;
export const refreshCookieSecure =
  process.env.REFRESH_COOKIE_SECURE !== undefined
    ? process.env.REFRESH_COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production' || refreshCookieSameSite === 'none';
export const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL || 'owner@example.com';
export const platformOwnerPassword = process.env.PLATFORM_OWNER_PASSWORD || 'Owner123!';
const parseList = (val: string | undefined) =>
  (val || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
export const corsAllowedOrigins = parseList(process.env.CORS_ALLOWED_ORIGINS || process.env.API_ALLOWED_ORIGINS || FRONTEND_BASE_URL);
export const corsAllowLocalhost = (process.env.CORS_ALLOW_LOCALHOST ?? (process.env.NODE_ENV !== 'production' ? 'true' : 'false')) === 'true';
export const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20);
export const authRateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000);
