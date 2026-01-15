import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const isPasswordStrong = (password: string) =>
  Boolean(password) && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

export const generateTempPassword = () => {
  let attempt = '';
  do {
    attempt = crypto.randomBytes(9).toString('base64url');
  } while (!isPasswordStrong(attempt));
  return attempt;
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = async (password: string, hash?: string | null) => {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
};

export const base64UrlEncode = (input: object | string) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64url');
export const signSegment = (data: string, secret: string) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
