Baseline (local)

- `pnpm -C apps/api test`: PASS (Vitest, 8 tests in `apps/api/src/server.spec.ts`).
- `pnpm -C apps/api typecheck`: PASS. (Initial run failed due to CORS origin callback typing; resolved by casting origin handler.)
- `pnpm -C apps/web lint`: PASS (eslint). No remaining warnings after fixes.

Not run yet: frontend typecheck/build, e2e/smoke.*** End Patch ***!
