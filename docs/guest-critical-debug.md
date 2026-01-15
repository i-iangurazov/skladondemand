## Guest critical flows debug

### Add to cart
- Expected: Clicking “Add” opens modifiers, defaults required options, joins the session if needed, and adds a line to the cart with a visible update or toast.
- Actual: Clicks could be no-ops when the session wasn’t joined or the socket wasn’t ready, and failures were silent.
- Root cause: Add path depended on an active socket/session and didn’t fall back to HTTP; missing join flow meant emits were ignored. Required modifiers were often satisfied, but the emit still died silently.
- Fix: Added `ensureSessionReady` + REST fallback `/public/sessions/:sessionId/cart` with clear errors; success updates cart state and shows a toast.

### Call waiter
- Expected: “Call waiter” notifies staff and confirms to the guest.
- Actual: Request was skipped when the session/token was missing; failures were silent.
- Root cause: Action only emitted over socket, gated by session state that wasn’t guaranteed; no HTTP path or toast error.
- Fix: Added REST endpoint `/public/sessions/:sessionId/assistance`, auto-join via `ensureSessionReady`, toast errors via `toastApiError`, and success toast.
