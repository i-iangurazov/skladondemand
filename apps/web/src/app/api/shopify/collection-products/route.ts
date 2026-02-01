import { NextResponse } from 'next/server';
import { getCollectionProductsPage } from '@/lib/shopify/storefront';

const allowedCountries = new Set(['GB', 'US', 'DE']);
const MAX_PAGE_SIZE = 36;

const toPositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');
  if (!handle) {
    return NextResponse.json({ error: 'Missing collection handle.' }, { status: 400 });
  }

  const countryParam = (searchParams.get('country') ?? 'GB').toUpperCase();
  const country = allowedCountries.has(countryParam) ? countryParam : 'GB';
  const pageSize = Math.min(toPositiveInt(searchParams.get('pageSize'), 24), MAX_PAGE_SIZE);
  const after = searchParams.get('after');

  const page = await getCollectionProductsPage({
    handle,
    after,
    first: pageSize,
    country,
    language: 'EN',
  });

  return NextResponse.json(page);
}
