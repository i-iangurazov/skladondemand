Backend/API audit
- Pagination helper `parsePagination` (page/pageSize, defaults 1/20) used on staff orders, admin tables/staff, owner tables (per-venue and cross-venue), owner users. Some list endpoints remain unpaginated (venues, owner per-venue users/tables when creating?).
- Event polling endpoints: `/admin/menu/events` and `/owner/venues/:venueId/menu/events` use `listMenuEvents` (version cursor). Websocket `menu.updated` emitted from `emitMenuUpdated`.
- Prisma schema `packages/db/prisma/schema.prisma`: menu versioning tables (Menu/MenuChangeEvent), Table has createdAt/updatedAt, indexes on venueId+sortOrder where applicable. Migrations in `packages/db/prisma/migrations/*` create menu/versioning and timestamp columns.

Findings
- Auth brute-force: staff/owner login now rate-limited, but limits are in-memory only (not distributed) and thresholds are hardcoded (`server.ts`). Consider configurable limits.
- CORS: allowed origins enforced via `API_ALLOWED_ORIGINS`, but socket.io also relies on the same runtime function via `as any` cast; type safety bypassed and no per-path restrictions.
- Pagination gaps: venue listing (`/owner/venues`) and some nested lists (owner per-venue users/tables) return full arrays without page info; responses don’t consistently include `pageInfo` type on all list endpoints.
- Idempotency: order submit and payment creation accept client-generated UUID but server doesn’t dedupe; potential double submissions under retries. No idempotency key persisted.
- Menu/color validation: accentColor validated server-side to hex, but category color is not validated; no image URL validation.
- Outstanding totals: backend computes outstanding via `computeOutstanding`, but API responses do not expose remaining balance; guest UI infers locally.
- Indexes: lists filter by role/status/date but `PaymentIntent` lacks venueId+createdAt index; `StaffSession/PlatformSession` indexed by expires but no index on revokedAt; may be acceptable but could be optimized.
- DTO alignment: staff orders response `pageInfo` optional in DTO previously; now required—ensure all callers use it (frontend still ignores).
- Seed scripts: owner seed enforces strong password; staff seed still hardcodes demo password; no idempotent menu/tables seed per venue yet.

Recommended Fixes (prioritized)
3) Idempotency: persist idempotency key for order submit/payment in DB (new column on orders/payments) or reject duplicates; expose failure codes. Files: Prisma schema/migration, server handlers.
6) Indexes: add createdAt index on `PaymentIntent(venueId, createdAt)` and optionally on sessions revokedAt for cleanups. Files: Prisma schema + migration.

Implemented
- Added explicit CORS allowlist with localhost toggle envs, typed origin handlers (no `any`), and socket.io alignment. Env: `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_LOCALHOST`.
- Hardened refresh cookies with configurable name/domain/path/samesite/secure/max-age and centralized set/clear helpers.
- Auth rate limiting now driven by `AUTH_RATE_LIMIT_MAX`/`AUTH_RATE_LIMIT_WINDOW_MS`; refresh endpoint rate-limited; brute-force lockouts retained.
- Token separation enforced via helpers and tests verifying staff vs platform tokens cannot be swapped.
- Standardized pagination/filter helpers (page/pageSize) with Zod-validated queries; tables/users/orders list endpoints now return consistent envelopes with pageInfo and support search/status/role/date filters. Added supporting Prisma indexes for tables/staff/orders.
- Guest order submit and payments now use persisted idempotency keys to prevent duplicates, and session state includes server-computed outstanding totals for guest flows.
- Payments now follow a server-driven quote + pay contract (FULL/EVEN/ITEMS) with idempotent payment creation, outstanding recalculation after each pay, and frontend wired to display quotes before confirmation.
