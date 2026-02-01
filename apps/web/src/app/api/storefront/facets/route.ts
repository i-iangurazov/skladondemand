import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGlobalFacetsForCollection, getGlobalFacetsForSearch } from '@/lib/shopify/adminFacets';
import { normalizeHandle } from '@/lib/shopify/handle';

const paramsSchema = z.object({
  mode: z.enum(['collection', 'search', 'all']).optional(),
  handle: z.string().trim().max(120).optional(),
  q: z.string().trim().max(80).optional(),
  country: z.string().trim().optional(),
  debug: z.string().optional(),
});

const allowedCountries = new Set(['GB', 'US', 'DE']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ brands: [], colors: [], availability: ['in', 'out'] }, { status: 200 });
  }

  const { mode, handle, q, country: countryParam, debug } = parsed.data;
  const normalizedHandle = normalizeHandle(handle);
  const effectiveMode = mode ?? (normalizedHandle ? 'collection' : q ? 'search' : 'all');

  if (effectiveMode === 'collection' && !normalizedHandle) {
    return NextResponse.json({ brands: [], colors: [], availability: ['in', 'out'] }, { status: 200 });
  }

  const country = allowedCountries.has((countryParam ?? 'GB').toUpperCase())
    ? (countryParam ?? 'GB').toUpperCase()
    : 'GB';

  const adminEnabled = Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  type FacetsResult = Awaited<ReturnType<typeof getGlobalFacetsForCollection>>;
  const emptyFacets: FacetsResult = { brands: [], colors: [], availability: ['in', 'out'] };
  let facets: FacetsResult =
    effectiveMode === 'collection' && normalizedHandle
      ? await getGlobalFacetsForCollection(normalizedHandle, { country, language: 'EN' })
      : effectiveMode === 'search' && q
        ? await getGlobalFacetsForSearch(q)
        : emptyFacets;

  if (!adminEnabled) {
    facets = emptyFacets;
  }

  const payload: Record<string, unknown> = {
    brands: facets.brands,
    colors: facets.colors,
    availability: facets.availability,
  };

  if (debug === '1') {
    payload.adminEnabled = adminEnabled;
    payload.scanQuery = facets.meta?.scanQuery ?? null;
    payload.sampleBrandTags = facets.meta?.sampleBrandTags ?? [];
    payload.colorMetafieldKey = facets.meta?.colorMetafieldKey ?? null;
    payload.rawColorValue = facets.meta?.rawColorValue ?? null;
    payload.parsedColors = facets.meta?.parsedColors ?? [];
    payload.colorMetafieldKeysTried = facets.meta?.colorMetafieldKeysTried ?? [];
    payload.colorSource = facets.meta?.colorSource ?? null;
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}
