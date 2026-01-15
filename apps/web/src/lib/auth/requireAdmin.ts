import { NextResponse } from 'next/server';
import { UserRole, type User } from '@qr/db';
import { getSessionUser } from './session';

type RequireAdminResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export const requireAdmin = async (request?: Request): Promise<RequireAdminResult> => {
  const user = await getSessionUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ code: 'errors.unauthorized' }, { status: 401 }) };
  }
  if (user.role !== UserRole.ADMIN) {
    return { ok: false, response: NextResponse.json({ code: 'errors.forbidden' }, { status: 403 }) };
  }
  return { ok: true, user };
};
