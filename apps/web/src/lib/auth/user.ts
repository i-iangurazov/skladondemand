import 'server-only';

import type { User, UserRole } from '@qr/db';

export type AuthUser = {
  id: string;
  name: string | null;
  phone: string;
  address: string | null;
  role: UserRole;
};

export const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  name: user.name ?? null,
  phone: user.phone,
  address: user.address ?? null,
  role: user.role,
});
