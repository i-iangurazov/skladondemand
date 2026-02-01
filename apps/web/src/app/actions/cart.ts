'use server';

import { cookies } from 'next/headers';
import { addLines, createCart, removeLines, updateLines } from '@/lib/shopify/cart';
import { getStorefrontContext } from '@/lib/shopify/context';
import { CART_COOKIE } from '@/lib/shopify/cart-cookie';

const setCartCookie = async (cartId: string) => {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
};

const getCartId = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE)?.value ?? null;
};

export async function addToCart(variantId: string, quantity = 1) {
  const context = await getStorefrontContext();
  const existingId = await getCartId();

  if (!existingId) {
    const cart = await createCart(
      {
        lines: [{ merchandiseId: variantId, quantity }],
        buyerIdentity: { countryCode: context.country },
      },
      context
    );
    await setCartCookie(cart.id);
    return cart;
  }

  try {
    return await addLines(existingId, [{ merchandiseId: variantId, quantity }], context);
  } catch {
    const cart = await createCart(
      {
        lines: [{ merchandiseId: variantId, quantity }],
        buyerIdentity: { countryCode: context.country },
      },
      context
    );
    await setCartCookie(cart.id);
    return cart;
  }
}

export async function updateCartLine(lineId: string, quantity: number) {
  const context = await getStorefrontContext();
  const cartId = await getCartId();
  if (!cartId) return null;
  return updateLines(cartId, [{ id: lineId, quantity }], context);
}

export async function removeCartLine(lineId: string) {
  const context = await getStorefrontContext();
  const cartId = await getCartId();
  if (!cartId) return null;
  return removeLines(cartId, [lineId], context);
}
