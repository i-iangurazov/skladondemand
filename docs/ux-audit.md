Frontend UX audit

Owner/admin (apps/web/src/app/owner/**, apps/web/src/app/admin/page.tsx)
- Menu management is minimal: no modifier/image/sort controls, no activation toggles, no confirmation dialogs. Forms lack validation and error detail surfaces.
- List endpoints not paginated in UI; tables/users views show all records with no filters by venue/status/role (only basic display).
- Auth UX: owner login remembers redirect; admin login shows only generic error; submit buttons sometimes lack loading/disabled feedback.
- Cross-venue context: owner tables/users cards show venue name but no deep link to venue detail; venue detail page lacks filters and pagination.
- Analytics: charts render but no loading/empty/error states or date range selector.

Guest table (apps/web/src/app/v/[venueSlug]/t/[tableCode])
- Menu skeletons/refresh CTA present; empty state message still generic. No venue/table metadata shown.
- Offline handling debounced; still no explicit “retry join” CTA when session closed/invalid.
- Payment/order: client validates splits and disables on double submit, but no idempotency token persisted; outstanding amount inferred locally and not shown per payment in list. Selecting items for payment lacks count/amount preview.
- Modals/dialogs for item selection absent; modifiers selection is inline only after tap.

Toasts (apps/web/src/components/ui/sonner.tsx, apps/web/src/app/layout.tsx)
- Defaults centralized (duration/close button), but richColors disabled by default; theme alignment is neutral. Some pages call `toast.error`/`toast.success` directly; no wrapper helper for consistent options.

Proposed fixes
- Owner/admin: enhance menu forms (modifiers, images, sortOrder, active/delete toggles), add confirmation dialogs; add pagination + filters (venue/status/role) to tables/users/orders; surface API errors inline; add loading/empty/error states for analytics with date range picker.
- Guest: add clear empty-menu card with “Notify staff” + “Refresh”; show outstanding amount and payment breakdown; add idempotency key header when creating payments/orders; show retry/join CTA when offline or session closed.
- Toasts: add small toast helper exporting standard options; replace direct imports where touched to keep consistent duration/positions.

Implemented
- Sonner Toaster defaults: duration 4s, close button on, neutral white surface with subtle shadow, accent left border per variant (success/info pink #F85270, warning soft #FCEAD0, error #DC143B); richColors disabled.
- Central toast helper (`apps/web/src/lib/toast.ts`) with toastSuccess/error/warning/info/apiError applying shared durations and ids; owner/admin/guest pages now call helper instead of raw `toast`.
