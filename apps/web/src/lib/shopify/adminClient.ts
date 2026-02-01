import 'server-only';

import { z } from 'zod';

const adminEnvSchema = z.object({
  SHOPIFY_STORE_DOMAIN: z.string().min(1),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_ADMIN_API_VERSION: z.string().min(1),
});

const getAdminConfig = () => {
  const parsed = adminEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error('Missing Shopify Admin API environment variables.');
  }
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_ADMIN_API_VERSION } = parsed.data;
  return {
    storeDomain: SHOPIFY_STORE_DOMAIN,
    accessToken: SHOPIFY_ADMIN_ACCESS_TOKEN,
    apiVersion: SHOPIFY_ADMIN_API_VERSION,
  };
};

export async function adminFetch<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const { storeDomain, accessToken, apiVersion } = getAdminConfig();
  const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin request failed: ${response.status} ${response.statusText} ${text}`.trim());
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    const message = json.errors.map((error) => error.message).join(' | ');
    throw new Error(`Shopify Admin GraphQL error: ${message}`);
  }

  if (!json.data) {
    throw new Error('Shopify Admin response missing data.');
  }

  return json.data;
}
