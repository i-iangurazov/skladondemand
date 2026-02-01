# API Routes

This repo contains two API surfaces:

- Next.js app routes (run with `pnpm dev`, base URL `http://localhost:3000`).

## Next.js app API (`apps/web/src/app/api`)

Auth: cookie-based DB session created by `/api/auth/login` (cookie name `session`, 180-day TTL). Admin endpoints require `User.role = ADMIN`.

### Auth
- `POST /api/auth/login`  
  Body: `{ phone: string, password: string }`  
  Response: `{ user }` + sets session cookie.
- `POST /api/auth/logout`  
  Response: `{ ok: true }` + clears session cookie.
- `GET /api/auth/me`  
  Response: `{ user }` (401 if no valid session).

### Catalog
- `GET /api/catalog?locale=en|ru|kg`  
  Response: `{ categories: [...] }` with localized names and variants.

### Telegram
- `POST /api/telegram-order`  
  Creates an Order snapshot and enqueues Telegram + WhatsApp notifications (async).  
  Includes customer block if a session exists; otherwise marks as guest.  
  Body: `{ locale?: string, items: [{ variantId: string, quantity: number }] }`  
  Response: `{ ok: true, orderId }` on success.

### Internal (server-only)
- `POST /api/internal/process-notifications`  
  Header: `x-internal-secret: <INTERNAL_SECRET>`  
  Body: `{ limit?: number, orderId?: string }`  
  Response: `{ ok: true, processed, sent, failed }`

### Admin: Customers (ADMIN only)
- `GET /api/admin/customers`  
  Response: `{ users: [{ id, name, phone, address, isActive, createdAt }] }`
- `POST /api/admin/customers`  
  Body: `{ name: string, phone: string, address?: string, password?: string }`  
  Response: `{ user, tempPassword? }`
- `PATCH /api/admin/customers/:id`  
  Body: `{ name?: string, address?: string, isActive?: boolean, password?: string }`  
  Response: `{ user }`

### Admin: Orders & notifications (ADMIN only)
- `GET /api/admin/orders`  
  Response: `{ orders: [{ id, createdAt, total, itemsSummary, customer, notifications }] }`
- `POST /api/admin/notifications/retry`  
  Body: `{ orderId: string }`  
  Response: `{ ok: true, updated, processed }`

### Admin: Import (ADMIN only)
- `POST /api/admin/import/parse-csv`  
  Multipart: `file` (CSV), optional `mapping` JSON string.  
  Response: `{ importId, rows, warnings, errors, checksum, columns, mapping }`
- `POST /api/admin/import/parse-pdf`  
  Multipart: `file` (PDF).  
  Response: `{ importId, rows, warnings, errors, checksum, needsReviewCount }`
- `POST /api/admin/import/parse-cloudshop-xlsx`  
  Multipart: `file` (XLSX).  
  Response: `{ importId, rows, warnings, errors, checksum, columns, needsReviewCount, sourceType }`
- `POST /api/admin/import/parse`  
  Multipart: `file` (CSV or PDF), optional `mapping`, optional `priceMode`.  
  Response: parse result for detected file type.
- `POST /api/admin/import/commit`  
  Body: `{ importId: string, checksum: string, priceMode?: "retail" | "wholesale", allowNeedsReview?: boolean, priceStrategy?: "sale" | "maxLocation", wholesaleLocation?: string | null, skipPriceZero?: boolean, skipMissingImage?: boolean }`  
  Response: `{ created, updated, skipped, failed, details }`
- `POST /api/admin/import/product-suggestions`  
  Body: `{ categoryRu: string, baseNameRu: string }`  
  Response: `{ candidates: [{ id, name, slug, score }], ambiguous, potentialDuplicate }`
- `POST /api/admin/import/undo-last`  
  Body: `{ importId?: string }` (omitted => last committed import).  
  Response: `{ importId, reverted: { categories, products, variants } }`

### Admin: Images (ADMIN only)
- `POST /api/admin/images/sync-drive`  
  Body: `{ folderId?: string }`  
  Response: `{ matched, updated, unmatched, skipped, errors, warnings, unmatchedFiles }`


Auth: Bearer tokens. Staff routes require `Authorization: Bearer <token>` from `/auth/login`.  
Owner routes require `Authorization: Bearer <token>` from `/owner/login`.

### Public
- `GET /health`
- `GET /public/venues/:venueSlug/menu`
- `POST /public/sessions/join`
- `GET /public/sessions/:sessionId/state`
- `POST /public/sessions/:sessionId/cart`
- `PATCH /public/sessions/:sessionId/cart/items/:cartItemId`
- `DELETE /public/sessions/:sessionId/cart/items/:cartItemId`
- `POST /public/sessions/:sessionId/assistance`
- `POST /public/sessions/:sessionId/orders`
- `POST /public/sessions/:sessionId/payments/split-plan`
- `POST /public/sessions/:sessionId/payments/quote`
- `POST /public/sessions/:sessionId/payments`
- `GET /public/payments/:paymentId`

### Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /owner/login`

### Staff
- `GET /staff/orders`
- `PATCH /staff/orders/:orderId/status`

### Admin (staff role ADMIN)
- `GET /admin/menu`
- `POST /admin/menu`
- `PATCH /admin/menu/:id`
- `DELETE /admin/menu/:id`
- `POST /admin/menu/seed`
- `GET /admin/menu/events`
- `GET /admin/tables`
- `POST /admin/tables`
- `PATCH /admin/tables/:id`
- `DELETE /admin/tables/:id`
- `GET /admin/staff`
- `POST /admin/staff`
- `PATCH /admin/staff/:id`
- `GET /admin/tables/:id/qr`
- `GET /admin/venues/:venueId/qr`
- `POST /admin/sessions/:sessionId/close`

### Owner (platform owner)
- `GET /owner/venues`
- `POST /owner/venues`
- `GET /owner/venues/:venueId`
- `PATCH /owner/venues/:venueId`
- `DELETE /owner/venues/:venueId`
- `GET /owner/venues/:venueId/tables`
- `POST /owner/venues/:venueId/tables`
- `POST /owner/venues/:venueId/tables/bulk`
- `PATCH /owner/venues/:venueId/tables/:tableId`
- `GET /owner/venues/:venueId/qr`
- `GET /owner/venues/:venueId/menu`
- `POST /owner/venues/:venueId/menu`
- `PATCH /owner/venues/:venueId/menu/:itemId`
- `DELETE /owner/venues/:venueId/menu/:itemId`
- `POST /owner/venues/:venueId/menu/seed`
- `GET /owner/venues/:venueId/menu/events`
- `GET /owner/tables`
- `GET /owner/users/all`
- `GET /owner/venues/:venueId/users`
- `POST /owner/venues/:venueId/users`
- `PATCH /owner/venues/:venueId/users/:userId`
- `GET /owner/stats`
- `GET /owner/venues/:venueId/stats`
