## Payments Audit

### A) Data model (packages/db/prisma/schema.prisma)
- `Order`: belongs to venue/session/table; has `status` enum (NEW, ACCEPTED, IN_PROGRESS, READY, SERVED, CANCELLED); relations to `OrderItem[]`, `PaymentIntent[]`; timestamps.
- `OrderItem`: `orderId`, qty, unitPrice, itemName, note; relation to `OrderItemModifier[]`.
- `OrderItemModifier`: attached to `orderItemId`, carries optionId/name/priceDelta.
- `PaymentIntent`: `venueId`, `sessionId`, optional `orderId`, `amount` (int cents), `status` enum (CREATED, PENDING, PAID, FAILED, CANCELLED), `payload` JSON (mode, items, splitCount, baseAmount, tipPercent, tipAmount, paidByDeviceHash). Used as payments; “paid” determined by status == PAID.
- Outstanding today: computed server-side via `computeOutstanding` using cart + active orders (excludes SERVED, CANCELLED) minus paid amounts (`payload.baseAmount` preferred).

### B) Current API surface (apps/api/src/server.ts)
- POST `/public/sessions/:sessionId/payments`
  - Request (PaymentCreateDto): { sessionId, amount?, orderId?, mode: FULL|EVEN|ITEMS, items?: string[], splitCount?: number, tipPercent?, tipAmount?, paidByDeviceHash?, idempotencyKey?, token }
  - Logic: loads cart + active orders (status not in SERVED,CANCELLED), optional order; `computeOutstanding` with mode/items/splitCount to get base/remaining/selectedCap. Computes `amount` mostly from client input (fallbacks: ITEMS→selectedCap; EVEN→ceil(base/splitCount); FULL→remaining). Checks amount<=remaining, creates PaymentIntent (CREATED) with payload incl. baseAmount, tip; immediately marks PAID (mock). Emits payment.updated. Idempotency via Idempotency-Key header and requestHash.
  - Outstanding in state excludes SERVED orders, so payments tied to served items may not reduce visible outstanding.
- GET `/public/payments/:paymentId`: fetch PaymentIntent (session token required).

Supporting functions:
- `computeOutstanding(sessionId, mode, { cart, orders, items, order })`: sums cart+orders totals, subtracts paid amounts (payload.baseAmount or amount) for PAID payments; for ITEMS mode, computes selectedTotal/selectedCap; for EVEN uses provided splitCount.

### C) Current frontend flow (apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx)
- Payment mode state: FULL | EVEN | ITEMS.
- Client computes `payableAmount`:
  - FULL: outstandingRemaining (outstanding from state = ordersActive + cart - paid).
  - EVEN: share = ceil(outstandingBase / splitCount); capped to remaining; payableAmount = share.
  - ITEMS: sum of selected cart items only (not orders) → `selectedItemsForPayment`; outstanding still computed from orders+cart, but selected payment uses cart item IDs (not order item IDs). Items must be selected; uses `payableAmount` for amount.
- On createPayment:
  - Validates splitCount, selected items.
  - Sends POST /payments with amount = payableAmount, mode, items = selectedItemsForPayment (cart IDs), splitCount, tip (percent or amount), idempotency key header.
  - On success, pushes payment locally and refetches session state; errors use generic toastError.
- Mismatches observed:
  - Server filters ordersActive to exclude SERVED, so outstanding may ignore served-but-unpaid orders; payments tied to served items may not change remaining displayed.
  - ITEMS mode uses cart item IDs; after submit order, cart empties and items become order items, so selected payment can’t target existing orders—server expects item IDs but outstanding is driven by orders, causing under/over payments or “Nothing to pay”.
  - Amount is client-calculated; server trusts `amount` when provided (for FULL/EVEN it uses client amount if sent), risking drift and over/under charge; no quote/lock step.
  - EVEN rounding is client-side (ceil on base), server also does ceil(base/splitCount) but using base (cart+orders) not remaining, leading to double-charge when partial payments already made; split count defaults to peopleCount, but client amount doesn’t account for already paid portions.
  - ITEMS selection can exceed remaining (server caps to selectedCap but uses provided amount if larger → rejects) and allows paying for already-paid selections if payload not validated against payments on order items (payments tracked only by total).
  - UI uses cart items for selection; paid items in orders remain outstanding until FULL/EVEN payment; no server-side itemization.

Summary of mismatches:
- Missing served orders in state → outstanding/visibility wrong after SERVED.
- Client-driven amount for FULL/EVEN; not authoritative, risk double-charge or rejects.
- ITEMS mode targets cart IDs, not order item IDs; after submit, cannot pay actual owed items.
- Even split rounding based on base, not remaining, causing mismatch after partial payments.
- Error surfacing inconsistent: createPayment catch uses toastError(t.paymentCreateFailed) instead of toastApiError with server message.
