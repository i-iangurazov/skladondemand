Accessible Typography
=====================

Scale (Tailwind classes)
- H1: `text-2xl font-semibold` — page titles
- H2: `text-xl font-semibold` — section titles
- H3: `text-lg font-semibold` — card titles / list headers
- Body: `text-base leading-6` — primary content everywhere (minimum 16px)
- Secondary: `text-sm leading-5` — helper text, labels, small metadata
- Micro: `text-xs` — badges/metadata only; never for primary content
- Price emphasis: `font-semibold` with size matching context (usually `text-base` or `text-lg`)

Usage rules
- Default text is body scale (`text-base leading-6`); do not go below 14px for readable content.
- Form labels and helper text use `text-sm`; inputs keep body size for legibility.
- Buttons: `text-sm` for dense controls, `text-base` for primary CTAs (keep tap targets).
- Status/metadata badges may use `text-xs` but keep contrast and padding.
- Headings should not skip levels; maintain clear hierarchy.

Focus/visibility
- Maintain visible focus rings (`focus-visible:ring-2 focus-visible:ring-primary/40`) on interactive elements.

Background
- Main app background stays white (`bg-background`), with neutral cards; color appears in accents, borders, and buttons only.
