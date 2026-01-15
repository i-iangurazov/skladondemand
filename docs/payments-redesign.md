Payments redesign audit
=======================

Current data model (packages/db/prisma/schema.prisma)
- Orders: `Order` + `OrderItem`/`OrderItemModifier` hold menu items, qty, unitPrice, modifiers, status enum NEW/ACCEPTED/IN_PROGRESS/READY/SERVED/CANCELLED.
- Payments: `PaymentIntent` has `id`, `venueId`, `sessionId`, optional `orderId`, optional `splitPlanId` and `sharesPaid`, `amount`, `status` enum (CREATED/PENDING/PAID/FAILED/CANCELLED), `provider`, `payload` json. Tips live in `payload` (`baseAmount`, `tipPercent`, `tipAmount`); outstanding subtracts only `baseAmount`.
- Sessions: `TableSession` has status (OPEN/CHECKOUT/CLOSED), `peopleCount`, `stateVersion` (default 1) but no code currently bumps it.
- Split/quote tables exist but are unused today: `SplitPlan` (sessionId, totalShares, baseVersion, locked) and `PaymentQuote` (sessionId, mode, amount, stateVersion, splitPlanId/sharesToPay/selectedItems, expiresAt).

Current API surface (apps/api/src/server.ts)
- HTTP `POST /public/sessions/:sessionId/payments/quote` (around createPaymentQuote wrapper)
  - Zod schema `PaymentQuoteRequestDto` expects `{ mode, stateVersion, splitPlanId?, sharesToPay?, selectedOrderItemIds?, tipCents?, token? }`, but handler forwards to `createPaymentQuote` which only understands `{ mode, splitCount?, items? }`; the DTO vs implementation mismatch currently means client payloads with `items/splitCount` or missing `stateVersion` fail validation.
  - Quotes are stored in an in-memory `Map` (`paymentQuotes`) with TTL, not persisted to the `PaymentQuote` table, and are not bound to `stateVersion`.
- HTTP `POST /public/sessions/:sessionId/payments`
  - Requires `quoteId` (per `PaymentCreateDto`), replays via idempotency helper. `createPaymentForQuote` reloads outstanding and re-calls `createPaymentQuote` to compare amounts, then creates a PaymentIntent and immediately marks it `PAID`. No DB transaction ties the quote validation and payment insert.
- Socket `payment.create` handler
  - Parses `PaymentCreateDto` but ignores `quoteId` and recomputes amount ad hoc using `computeOutstanding`; idempotency hash is built from amount/mode/splitCount/items. Payment is immediately marked `PAID`.
- Guest state `GET /public/sessions/:id/state`
  - Returns cart/orders/payments/outstanding and `stateVersion` from DB, but nothing ever increments `stateVersion`.
- No endpoint exists to create/update a split plan or to lock shares; split fields on `PaymentIntent` are unused.

Current frontend calculations (apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx)
- Outstanding derives from client math if server omitted: `outstandingBase = outstanding?.base ?? cart+orders total`; `paidBase` sums `payments` with status `PAID` (`payload.baseAmount` if present); `outstandingRemaining = base - paid`.
- EVEN mode: `payableAmount` uses `Math.ceil(outstandingBase / splitCount)` capped to remaining; `splitCount` defaults to peopleCount input. No share tracking; recomputed every render.
- ITEMS mode: builds `payableOrderItems` from orders and sums selected ids; no knowledge of prior allocations per item.
- Quotes: `refreshQuote` posts `{ mode, splitCount, items }` (no `stateVersion`, no splitPlanId). A quote is considered “stale” purely by comparing mode/splitCount/selected ids, not by server version.
- Payments: `createPayment` retries by refreshing quote if `quoteStale`; sends tip separately. Buttons disable while pending, but stateVersion used for invalidating quotes is actually `Date.parse(lastActiveAt)`, not the server `stateVersion`.

Mismatches / failure modes (with file+function references)
- Split re-computed repeatedly (apps/api/src/server.ts:createPaymentQuote + frontend payable logic): EVEN quotes always recompute `ceil(remaining / splitCount)` without consuming shares or referencing `SplitPlan`; clients can ask for another quote after someone else paid and get a new (often smaller) “share,” enabling serial under/over-payments instead of fixed allocations.
- Rounding inconsistency between quote and charge (apps/api/src/server.ts:createPaymentQuote vs socket `payment.create` computePayment): quotes price `ceil(remaining / splitCount)` while the socket path uses `Math.ceil(base / splitCount)` capped to remaining. After a partial payment, the quote can be 250 while the socket payment charges 500 for the same splitCount, causing divergent outcomes depending on which path executes.
- Selected item overlap (apps/api/src/server.ts:computeOutstanding mode 'ITEMS' and createPaymentQuote): selection just sums matching ids and caps by global remaining; it never subtracts previously paid portions of those items. Two guests can both select the same `orderItemId` and each pay up to the outstanding cap, double-paying until the whole bill is covered.
- “Paying for others” leaves shares undefined (apps/api/src/server.ts:createPaymentQuote / createPaymentForQuote): paying multiple “shares” is indistinguishable from a single share because splitCount never decrements and there is no `sharesPaid` usage. After someone pays extra, the next EVEN quote recomputes from the remaining total/constant splitCount, yielding distorted share sizes.
- Concurrency and stale state (apps/api/src/server.ts:createPaymentQuote/createPaymentForQuote and `paymentQuotes` map):
  - Quotes are in-memory and not locked to `stateVersion`; stale clients are not rejected. Two guests can fetch quotes simultaneously; because validation is a re-run of the same stateless calculation, both can pay as long as remaining covered both quotes at validation time—no row locks or share reservation.
  - `stateVersion` exists on `TableSession` but `bumpStateVersion` is never called, so versioning cannot protect against concurrent updates; the frontend also derives its `stateVersion` from `lastActiveAt`, not the DB field, so even if it advanced the UI would not send it.
- API contract drift (apps/api/src/server.ts payments endpoints vs packages/types/src/index.ts): DTOs expect `stateVersion`, `splitPlanId`, `sharesToPay`, `selectedOrderItemIds`, but implementations still consume legacy `splitCount`/`items`; frontend uses the legacy shape. This mismatch breaks validation and prevents server-driven versioning/selection checks.

Files of interest
- API: `apps/api/src/server.ts` — `computeOutstanding`, `createPaymentQuote`, `createPaymentForQuote`, `/payments` HTTP handlers, socket `payment.create`, unused `bumpStateVersion`.
- Frontend: `apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx` — outstanding/payable math, quote request/refresh logic, payment submission.
- Types: `packages/types/src/index.ts` — `PaymentQuoteRequestDto`, `PaymentCreateDto`, enums for payment/order/session statuses.

Critical bug to address
- EVEN split lacks a server-side share plan: shares are not reserved or decremented, allowing repeated “split again” actions and inconsistent amounts when other guests pay or when calls race, leading to nonsensical allocations and potential over/under-payment.
