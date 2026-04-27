---
id: 013
priority: P1
area: backend, client, react, contracts
status: open
package: 'all'
title: No automated test coverage on any of the four packages
---

## Summary

A grep for `*.spec.ts` and `*.test.ts` under `packages/*/src/` returns zero files. The libraries publish auth flows, token rotation, MFA, multi-tenant context, role guards — all critical, all currently unverified by tests.

## Where

- `packages/nest-auth/src/` — 0 test files
- `packages/nest-auth-client/src/` — 0 test files
- `packages/nest-auth-react/src/` — 0 test files
- `packages/nest-auth-contracts/src/` — 0 test files (acceptable here — types-only)

## Impact

Every fix in this `.tasks/` directory ships without regression coverage. The bugs in #001, #002, #003, #004 alone would have been caught by basic integration tests.

## Recommended scope (do not boil the ocean)

Phase 1 — minimal smoke (1 day):

1. **`@ackplus/nest-auth`**
   - SQLite + `MEMORY` session store
   - signup → login → `/auth/me` (assert `user.id` is UUID, catches #003/#004)
   - admin signup → admin login (catches #001)
   - signup → MFA enable → MFA verify → login round-trip (catches #010 if all providers wired)

2. **`@ackplus/nest-auth-client`**
   - mock `HttpAdapter`
   - login → `getSessionUserData` → logout
   - 401 → refresh → retry once round-trip
   - `RefreshQueue`: 100 concurrent 401s → 1 refresh

3. **`@ackplus/nest-auth-react`**
   - `<AuthProvider>` mount + `useUser()` reflects login state
   - `<RequireRole>` renders children only when role matches

Phase 2 — broader coverage as bandwidth allows.

## Tooling

- Vitest (already a peer in many `next/*` ecosystems) or Jest (consistent with NestJS conventions). Pick one.
- Add `pnpm test` to root `package.json` that runs `pnpm -r run test`.
- Add CI step in `.github/workflows/publish.yml` (gating publish) and create a `ci.yml` that runs on every PR.

## Verification

- `pnpm test` returns non-zero on a deliberately-broken commit (e.g. revert #001).
- Coverage report attached to PRs (Codecov / Coveralls or just text output).
