## Realtime verification steps

1) Open two guest windows on the same table session (e.g., `/v/demo/t/T1`).
2) In window A, add an item to the cart. Within ~1s window B should show the cart update; if socket is offline, it will catch up via polling within ~8s.
3) Submit the order in window A. Kitchen view should show the new order (NEW) and window B should see it in the orders list.
4) In the kitchen view, advance the order status to READY. Both guest windows should see the status update within ~1s (or after reconnect/poll).
5) Toggle network offline in one guest for a short period; on reconnect, state should resync via the reconnect fetch/poll.
