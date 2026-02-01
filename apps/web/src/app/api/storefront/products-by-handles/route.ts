import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProductsByHandles } from '@/lib/shopify/storefront';
import { getStorefrontContext } from '@/lib/shopify/context';

const schema = z.object({
  handles: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  country: z.string().trim().optional(),
});

const allowedCountries = new Set(['GB', 'US', 'DE']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const context = await getStorefrontContext();
  const countryParam = parsed.data.country?.toUpperCase();
  const country = allowedCountries.has(countryParam ?? '')
    ? (countryParam as string)
    : context.country;

  const handles = parsed.data.handles
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean);
  if (!handles.length) {
    return NextResponse.json({ items: [] });
  }

  const items = await getProductsByHandles(handles, { country, language: context.language });
  return NextResponse.json({ items });
}
