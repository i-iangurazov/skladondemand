## Realtime contract (guest + kitchen)

- Rooms:
  - session room: `tableSession:{sessionId}` — all guests for a table/session join this room.
  - kitchen room: `venue:{venueId}:kitchen` — kitchen dashboards.
  - waiters room: `venue:{venueId}:waiters` — waiter notifications.
- Canonical invalidation event (server → clients):
  - `table.stateChanged` → session room. Payload: `{ sessionId, reason, at }`.
  - Emitted after cart writes, assistance, order submit, cart quantity/remove, and order status changes.
  - Clients refetch `/public/sessions/:sessionId/state` on receipt and replace local state.
- Legacy/full events (still emitted for compatibility):
  - `cart.updated` (session), `order.created` (session + kitchen), `order.updated` (session + kitchen + waiters on READY/SERVED), `payment.updated`, `table.assistanceRequested`.
- Joins:
  - Guests call `session.join` with `sessionId` + session token; server adds them to `tableSession:{sessionId}`.
  - Kitchen calls `kitchen.subscribe` with venue + staff token; server adds them to `venue:{venueId}:kitchen`.
- Fallback:
  - Guest page polls `/public/sessions/:sessionId/state` every ~8s when socket is offline and once on reconnect; additional 5s guard re-fetch if no stateChanged seen for 10s.
