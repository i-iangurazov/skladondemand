## Cart debug note

- **Issue**: Guest users could not add menu items to the cart when a required modifier group had no initial selection; the “Add to cart” button stayed disabled with no guidance.
- **Root cause**: Required modifier groups lacked a default choice, so `canAddSelectedItem` was always false until the user manually picked options. In seeded/demo data every item had required modifiers, making the cart appear broken.
- **Fix**: Added `ensureDefaultSelection` helper to preselect the first active options for required modifier groups when opening the item dialog. Also surface a toast when modifiers are missing and add optional debug logging guarded by `NEXT_PUBLIC_GUEST_DEBUG`.
- **Files touched**: `apps/web/src/app/v/[venueSlug]/t/[tableCode]/page.tsx`, `apps/web/src/lib/cartSelection.ts`, `apps/web/src/__tests__/cart-selection.spec.ts`.
