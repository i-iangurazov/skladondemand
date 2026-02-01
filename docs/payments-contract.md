# Payments contract (audit + target behavior)

This document defines the contract for guest payments across FULL, EVEN, and SELECTED modes before implementation changes. It captures the current data model and code paths, the desired boundaries between draft cart vs. payable order items, and the rules that keep quotes/payment flows consistent.

## Data model (current vs. required)
- **Upcoming allocation model**: introduce `PaymentAllocation` (planned) with `paymentId`, `orderItemId`, `amountCents`, `createdAt` + uniqueness to prevent double-paying the same portion. SELECTED mode will populate this on confirmation.

## What each payment mode pays for
- **FULL**: Pays the remaining outstanding balance for all placed `OrderItem`s (not draft cart). Quote and payment amounts are capped to the remaining cents at the stateVersion used to build the quote. Tips are additive and must match the quoted tip.
- **EVEN**: Pays deterministic shares from a session-scoped `SplitPlan`. Quote computes from `{ remainingCents, remainingShares, sharesToPay }` where `remainingShares = totalShares - paidShares` (paidShares derived from confirmed payments/allocations). Quote must record `splitPlanId`, `sharesToPay`, share costs, and stateVersion; payment locks the plan row and consumes those shares.
- **SELECTED**: Pays the remaining unpaid portion of specific `OrderItem` ids. Quote validates that each item belongs to the session/table and still has remaining > 0, returning a breakdown per item. Payment confirmation creates `PaymentAllocation` rows and reduces remaining for those items; reselecting an already-fully-paid item must 409.

## StateVersion rules
- Quote requests include the client stateVersion; server returns 409 `STALE_STATE` with `{ serverStateVersion, state }` when mismatched.
- Payment creation revalidates against the quote’s stateVersion; if server advanced and amounts no longer match, it returns 409 `STALE_STATE`.

## UI rules (guest table page)
- **Draft cart vs. sent orders**: Draft cart remains fully editable (qty/remove) until submitted. Submitted `OrderItem`s are rendered read-only by default; paid items are always read-only. These views live in `apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx` and `components/CartSheet.tsx`.
- **Paid obligations cannot be removed**: Any attempt to delete/update an `OrderItem` with allocations or after submission returns 409; the UI must surface the server message and keep the item visible (no silent removal).
- **Selected payments**: Selection list is built from `OrderItem`s with `remainingCents > 0`; items fully paid are disabled. Conflicts (409) trigger a state refresh and a clear message.
- **Even split auto-refresh**: While the payment modal is open, the client subscribes to `table.stateChanged` (socket in `page.tsx`) and automatically re-requests the quote when `stateVersion` changes; no manual refresh is required for correctness. Updated quotes show an “Updated” hint; invalid selections prompt reselection.
- **Outstanding display**: Outstanding amounts should reflect placed orders minus confirmed payments only; draft cart totals are shown separately for context.

## Endpoint contract (to be enforced)
- `POST /public/sessions/:sessionId/payments/quote` → `{ quoteId, amountCents, breakdown, stateVersion }`; responds 409 `STALE_STATE` when client version lags; quotes expire (60–120s) and are invalidated by conflicting payments.
- `POST /public/sessions/:sessionId/payments` accepts a `quoteId`; on success emits `payment.updated` and bumps stateVersion; on conflict returns 409 with state payload.
- Guest state (`GET /public/sessions/:sessionId/state`) returns both `draftCart` (editable) and `orders`/`orderItems` with payment status, plus `stateVersion`, so the UI can keep cart/order sections separate.

## Current code references
- Data model: `packages/db/prisma/schema.prisma` — `CartItem`, `Order`/`OrderItem`, `PaymentIntent`, `PaymentQuote`, `SplitPlan`, planned `PaymentAllocation` slot.
- Frontend: `apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx` (state management, quote refresh, payment submission) and `components/CartSheet.tsx` (cart editing vs. payment UI).
