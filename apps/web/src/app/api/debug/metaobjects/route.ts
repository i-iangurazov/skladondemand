import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminFetch } from '@/lib/shopify/adminClient';

const paramsSchema = z.object({
  definitionsFirst: z.coerce.number().int().min(1).max(50).optional(),
  definitionsAfter: z.string().trim().max(200).optional(),
  includeObjects: z.string().optional(),
  type: z.string().trim().max(80).optional(),
  objectsFirst: z.coerce.number().int().min(1).max(50).optional(),
  objectsAfter: z.string().trim().max(200).optional(),
});

const METAOBJECT_DEFINITIONS_QUERY = `#graphql
  query MetaobjectDefinitions($first: Int!, $after: String) {
    metaobjectDefinitions(first: $first, after: $after) {
      nodes {
        id
        name
        type
        fieldDefinitions {
          key
          name
          type {
            name
            category
          }
          required
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const METAOBJECTS_BY_TYPE_QUERY = `#graphql
  query MetaobjectsByType($type: String!, $first: Int!, $after: String) {
    metaobjects(type: $type, first: $first, after: $after) {
      nodes {
        id
        handle
        type
        fields {
          key
          value
          type {
            name
            category
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function GET(request: Request) {
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Admin access token missing.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
  }

  const {
    definitionsFirst = 20,
    definitionsAfter,
    includeObjects,
    type,
    objectsFirst = 20,
    objectsAfter,
  } = parsed.data;

  const definitionsData = await adminFetch<{
    metaobjectDefinitions: {
      nodes: Array<{
        id: string;
        name: string;
        type: string;
        fieldDefinitions: Array<{ key: string; name: string; type: string; required: boolean }>;
      }>;
      pageInfo: { hasNextPage: boolean; endCursor?: string | null };
    };
  }>(METAOBJECT_DEFINITIONS_QUERY, {
    first: definitionsFirst,
    after: definitionsAfter ?? null,
  });

  const payload: Record<string, unknown> = {
    definitions: definitionsData.metaobjectDefinitions.nodes,
    definitionsPageInfo: definitionsData.metaobjectDefinitions.pageInfo,
  };

  if (includeObjects === '1' && type) {
    const objectsData = await adminFetch<{
      metaobjects: {
        nodes: Array<{
          id: string;
          handle?: string | null;
          type: string;
          fields: Array<{ key: string; value: string | null; type: string }>;
        }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    }>(METAOBJECTS_BY_TYPE_QUERY, {
      type,
      first: objectsFirst,
      after: objectsAfter ?? null,
    });

    payload.objects = objectsData.metaobjects.nodes;
    payload.objectsPageInfo = objectsData.metaobjects.pageInfo;
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
