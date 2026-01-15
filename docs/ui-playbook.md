## UI Playbook (web)

- **Typography scale**: base body `text-base` (16px) with `leading-6`; section titles `text-lg font-semibold`; labels/metadata `text-sm text-muted-foreground`.
- **Spacing rules**: sections `space-y-6` with `p-4` (md: `p-6`); cards use `p-4`; dense grids `gap-3`, default grids `gap-4`.
- **State patterns**: loading = inline skeletons in place; empty = bordered card with short copy + CTA; error = toast via `toastApiError` and inline card if the list is blank.
- **Action hierarchy**: primary = `variant="default"` (brand), secondary = `variant="secondary"`, outline for tertiary, destructive only for irreversible actions; disable buttons while pending and show spinner when possible.
- **Palette usage (white-first)**: main surfaces `bg-background`; accents only via `primary` and tints (`bg-brandTint/30`, `bg-warnTint/40`), destructive only for errors; avoid colored backgrounds for entire pages.
- **Radius rules**: cards/panels use `rounded-lg`, pills use `rounded-full`, form controls use `rounded-md`.
