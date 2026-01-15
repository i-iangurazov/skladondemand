# Quality sweep (no surprises)

Commands run
- pnpm -C apps/api typecheck ✅
- pnpm -C apps/api test ✅
- pnpm -C apps/web lint ✅
- pnpm -C apps/web test ✅
- pnpm -C apps/web build ✅ (forced webpack to avoid Turbopack hang)

Build / bundler notes
- `next/font` Google fetch failed offline; switched layout to local/system font vars so builds work without network.
- Turbopack (`pnpm -C apps/web build`) hung; build script now uses `next build --webpack` for deterministic CI/dev builds.

Static scans
- as any: found in `apps/api/src/server.ts` (Prisma DTO mapping/enum narrowing) and `apps/api/src/server.spec.ts` (test mocks); left as-is for now, no new usages added in this sweep.
- ts-ignore: none.
- eslint-disable: only targeted (`seed` scripts allow console, owner venue page opts out of exhaustive-deps for stable menu load effect).

Remaining watch items
- Consider tightening the lingering `as any` in API mapping/tests when time allows.
