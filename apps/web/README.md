# skladondemand storefront

Next.js App Router storefront powered by the Shopify Storefront API.

## Environment

Create `.env.local` in the repo root with:

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2025-01
DEFAULT_COUNTRY=GB
DATABASE_URL=postgresql://skladon:skladon@localhost:5432/skladondemand?schema=public
AUTH_JWT_SECRET=change-me
```

## Development

Use Node 20.x (for example via `nvm use 20`).

```bash
docker compose up -d
pnpm --filter @qr/db prisma:migrate
pnpm dev
```

Open `http://localhost:3000` to view the storefront.
