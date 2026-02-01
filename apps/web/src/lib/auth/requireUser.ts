import 'server-only';

import { prisma } from '@/lib/db';
import { getSessionFromCookies } from './jwt';

export const requireUser = async () => {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      createdAt: true,
    },
  });
  return user;
};
