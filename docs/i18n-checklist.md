I18n checklist (en/ru/kg)
=========================

Pages reviewed
- Guest table `/v/[venueSlug]/t/[tableCode]`
- Kitchen `/kitchen`
- Waiter `/waiter`
- Owner dashboard `/owner/venues`, owner login
- Admin dashboard `/admin`

Notes
- UI chrome strings use `getTranslations(lang)`; dynamic data (menu items, venue names) stays untranslated.
- Language selection via `useLanguage` persists in `localStorage`.
- Missing keys warn in dev via `validateTranslations` in `apps/web/src/lib/i18n.ts`.
- Default locale: `en`.

Pending follow-ups
- Re-check future UI additions for hardcoded strings.
