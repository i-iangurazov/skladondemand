This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## How to import from PDF/CSV

1) Sign in with an ADMIN account.
2) Visit `/admin/import`.
3) Upload a `.csv` or `.pdf` (max 10MB).
4) For CSV:
   - Confirm the column mapping (category, product, price are required).
   - Extra columns are stored in `variant.attributes`.
5) Review the preview table; low-confidence PDF rows are marked “Needs review”.
6) If low-confidence rows exist, confirm “I reviewed low-confidence rows” to enable commit.
7) Click “Commit import” and review the summary.
8) Use “Undo last import” to deactivate items created by the last commit.

Notes:
- SKU is the primary key; missing SKUs are replaced by a stable `AUTO-` hash.
- Price values are normalized to integer KGS.
- PDF parsing runs server-side; low-confidence rows are marked “Needs review”.
- Server-side PDF parsing uses `pdf-parse` (run `pnpm install` to update the lockfile).

## Auth & customers

1) Run migrations and generate the Prisma client:
```bash
pnpm --filter @qr/db prisma:migrate -- --name add-session
pnpm --filter @qr/db prisma:generate
```
2) Create an admin user (once):
```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YourPass123',10).then(console.log)"
pnpm --filter @qr/db prisma:studio
```
Use Prisma Studio to insert a `User` with:
- `role = ADMIN`
- `phone = +996XXXXXXXXX`
- `passwordHash = <hash from the command>`

3) Log in at `/login` using phone + password.
4) Log out with `POST /api/auth/logout` (clears the session cookie).
5) Create customers in `/admin/customers` (password optional; temp password is shown once).

## Order notifications (Telegram + WhatsApp Cloud API)

1) Set env vars in `.env.local` (server-side only):
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v21.0
WHATSAPP_RECIPIENTS=+996700000000,+996555000000
WHATSAPP_MODE=template
WHATSAPP_TEMPLATE_NAME_ORDER=new_order
WHATSAPP_TEMPLATE_LANG=ru
INTERNAL_SECRET=your-internal-secret
```

2) Create a WhatsApp template named `new_order` with placeholders:
```
New order {{1}}. Customer: {{2}} ({{3}}). Address: {{4}}. Total: {{5}}. Items: {{6}}
```

3) Run migrations:
```bash
pnpm --filter @qr/db prisma:migrate
pnpm --filter @qr/db prisma:generate
```

4) Process notification jobs:
- Recommended: call `POST /api/internal/process-notifications` from a cron with header `x-internal-secret: <INTERNAL_SECRET>`.
- Fallback: jobs are also triggered after each order and can be retried from `/admin/orders`.
