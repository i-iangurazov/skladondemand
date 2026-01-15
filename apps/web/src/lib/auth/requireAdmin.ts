import { NextResponse } from 'next/server';
import { UserRole } from '@qr/db';
import { getSessionUser } from './session';

export const requireAdmin = async (request?: Request) => {
  const user = await getSessionUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ code: 'errors.unauthorized' }, { status: 401 }) };
  }
  if (user.role !== UserRole.ADMIN) {
    return { ok: false, response: NextResponse.json({ code: 'errors.forbidden' }, { status: 403 }) };
  }
  return { ok: true, user };
};
