## Kitchen flow debug

- Expected: Guest submits order → backend creates order with status NEW → emits `order.created` to kitchen room → kitchen UI lists it.
- Actual: Order submission silently failed when socket path wasn’t available; kitchen never saw tickets.
- Root cause: Guest submit used socket-only `order.submit` with no HTTP fallback; if socket wasn’t joined/ready the emit was dropped. Additionally, idempotency table might be missing; now we fall back gracefully instead of 500.
- Fix: Added REST endpoint `POST /public/sessions/:sessionId/orders` backed by shared `submitOrderForSession` helper that validates token/session, creates order, clears cart, and emits `order.created` (kitchen + session). Guest UI now calls this endpoint with toastApiError on failures and success toast on submit. Idempotency helper now falls back if the idempotency table is absent (avoids P2021 crash).
