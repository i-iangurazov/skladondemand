import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchSuggestions } from '@/lib/shopify/storefront';

const allowedCountries = new Set(['GB', 'US', 'DE']);

const paramsSchema = z.object({
  q: z.string().trim().min(2).max(60),
  country: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ products: [], collections: [] }, { status: 200 });
  }

  const countryParam = (parsed.data.country ?? 'GB').toUpperCase();
  const country = allowedCountries.has(countryParam) ? countryParam : 'GB';

  const data = await searchSuggestions({
    query: parsed.data.q,
    country,
    language: 'EN',
  });

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
