import 'server-only';

import { cookies } from 'next/headers';

export const CART_COOKIE = 'skladondemand_cart';

export const getCartIdFromCookies = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE)?.value ?? null;
};
