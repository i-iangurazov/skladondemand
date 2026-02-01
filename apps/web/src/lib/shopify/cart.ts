import 'server-only';

import { z } from 'zod';
import { shopifyFetch } from './client';
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
} from './queries';
import { imageSchema, moneySchema } from './schemas';

const selectedOptionSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const cartLineSchema = z.object({
  id: z.string(),
  quantity: z.number(),
  cost: z.object({
    amountPerQuantity: moneySchema,
    totalAmount: moneySchema,
  }),
  merchandise: z.object({
    id: z.string(),
    title: z.string(),
    selectedOptions: z.array(selectedOptionSchema),
    product: z.object({
      handle: z.string(),
      title: z.string(),
      featuredImage: imageSchema.optional(),
    }),
  }),
});

const cartSchema = z.object({
  id: z.string(),
  checkoutUrl: z.string(),
  totalQuantity: z.number(),
  cost: z.object({
    subtotalAmount: moneySchema,
    totalAmount: moneySchema,
    totalTaxAmount: moneySchema.nullable().optional(),
  }),
  lines: z.object({
    nodes: z.array(cartLineSchema),
  }),
});

export type CartLine = z.infer<typeof cartLineSchema>;

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: z.infer<typeof cartSchema>['cost'];
  lines: CartLine[];
};

export type CartLineInput = {
  merchandiseId: string;
  quantity: number;
};

export type CartLineUpdateInput = {
  id: string;
  quantity: number;
};

const mapCart = (input: z.infer<typeof cartSchema>): Cart => ({
  id: input.id,
  checkoutUrl: input.checkoutUrl,
  totalQuantity: input.totalQuantity,
  cost: input.cost,
  lines: input.lines.nodes,
});

const assertUserErrors = (errors?: Array<{ message: string }>) => {
  if (errors && errors.length) {
    throw new Error(errors.map((error) => error.message).join(' | '));
  }
};

export async function getCart(cartId: string, options?: { country?: string; language?: string }) {
  const data = await shopifyFetch<{ cart: z.infer<typeof cartSchema> | null }>(CART_QUERY, {
    variables: { id: cartId },
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  if (!data.cart) return null;
  return mapCart(cartSchema.parse(data.cart));
}

export async function createCart(
  params: { lines?: CartLineInput[]; buyerIdentity?: { countryCode?: string } },
  options?: { country?: string; language?: string }
) {
  const data = await shopifyFetch<{
    cartCreate: { cart: z.infer<typeof cartSchema> | null; userErrors: Array<{ message: string }> };
  }>(CART_CREATE_MUTATION, {
    variables: { input: params },
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  assertUserErrors(data.cartCreate.userErrors);
  if (!data.cartCreate.cart) throw new Error('Shopify cartCreate returned no cart.');
  return mapCart(cartSchema.parse(data.cartCreate.cart));
}

export async function addLines(
  cartId: string,
  lines: CartLineInput[],
  options?: { country?: string; language?: string }
) {
  const data = await shopifyFetch<{
    cartLinesAdd: { cart: z.infer<typeof cartSchema> | null; userErrors: Array<{ message: string }> };
  }>(CART_LINES_ADD_MUTATION, {
    variables: { cartId, lines },
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  assertUserErrors(data.cartLinesAdd.userErrors);
  if (!data.cartLinesAdd.cart) throw new Error('Shopify cartLinesAdd returned no cart.');
  return mapCart(cartSchema.parse(data.cartLinesAdd.cart));
}

export async function updateLines(
  cartId: string,
  lines: CartLineUpdateInput[],
  options?: { country?: string; language?: string }
) {
  const data = await shopifyFetch<{
    cartLinesUpdate: { cart: z.infer<typeof cartSchema> | null; userErrors: Array<{ message: string }> };
  }>(CART_LINES_UPDATE_MUTATION, {
    variables: { cartId, lines },
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  assertUserErrors(data.cartLinesUpdate.userErrors);
  if (!data.cartLinesUpdate.cart) throw new Error('Shopify cartLinesUpdate returned no cart.');
  return mapCart(cartSchema.parse(data.cartLinesUpdate.cart));
}

export async function removeLines(
  cartId: string,
  lineIds: string[],
  options?: { country?: string; language?: string }
) {
  const data = await shopifyFetch<{
    cartLinesRemove: { cart: z.infer<typeof cartSchema> | null; userErrors: Array<{ message: string }> };
  }>(CART_LINES_REMOVE_MUTATION, {
    variables: { cartId, lineIds },
    country: options?.country,
    language: options?.language,
    cache: 'no-store',
  });

  assertUserErrors(data.cartLinesRemove.userErrors);
  if (!data.cartLinesRemove.cart) throw new Error('Shopify cartLinesRemove returned no cart.');
  return mapCart(cartSchema.parse(data.cartLinesRemove.cart));
}
