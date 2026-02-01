import 'server-only';

import { unstable_cache } from 'next/cache';
import { adminFetch } from './adminClient';

const COLLECTION_ID_QUERY = `#graphql
  query CollectionAdminId($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      title
    }
  }
`;

const fetchCollectionId = async (handle: string) => {
  const data = await adminFetch<{ collectionByHandle: { id: string } | null }>(COLLECTION_ID_QUERY, {
    handle,
  });
  return data.collectionByHandle?.id ?? null;
};

export const getCollectionAdminIdByHandle = async (handle: string) =>
  unstable_cache(
    () => fetchCollectionId(handle),
    ['shopify-admin-collection-id', handle],
    { revalidate: 600 }
  )();
