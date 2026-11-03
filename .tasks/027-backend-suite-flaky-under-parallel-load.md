---
id: 027
priority: P2
area: testing
status: open
package: '@ackplus/nest-auth'
title: 'Backend integration suite times out one random file per full run'
---

## Summary

`pnpm -C packages/nest-auth test` reliably fails **one** test file per full run with `Test timed out in 60000ms`, and it is a **different file each time**. Every one of them passes in well under a second when run on its own.

Observed across consecutive runs of the same commit:

| Run | Failing file | Alone |
| --- | --- | --- |
| 1 | `custom-auth-provider`, `mfa-recovery-codes`, `security-hardening` | all pass (19 tests, 4.7s) |
| 2 | `admin-platform-users > scope filters work the same as in SHARED` | passes |
| 3 | `mfa-status-toggle > a user with MFA OFF can still toggle…` | passes (3 tests, 0.5s) |

Totals stay at ~350 passed / 1 failed out of 352.

## Where

- `packages/nest-auth/vitest.config.ts` (pool/concurrency settings) and `packages/nest-auth/test/helpers/boot-test-app.ts` — each integration file boots a full Nest app with its own sqljs or Postgres connection.

## Impact

CI is not trustworthy: a red build carries no information, so a real regression is indistinguishable from the usual flake, and the habit becomes "just re-run it". It also cost real time during [025](025-issue-13-per-request-db-reads-and-cross-instance-staleness.md) — three failures had to be stash-tested against a clean tree to prove they were not caused by the change under review.

## Fix hypothesis

Resource contention from booting many apps at once, not a logic bug: the symptom is a hard 60s timeout rather than an assertion failure, and it never reproduces in isolation. Candidates, cheapest first:

1. Cap `maxConcurrency` / use `pool: 'forks'` with a bounded `maxForks` so fewer apps boot simultaneously.
2. Raise `testTimeout` for the integration directory — treats the symptom, not the cause, but stops the false reds.
3. Share one app instance per file via `beforeAll` where the tests do not need isolation (several files already boot per test).
4. Check for leaked connections/timers keeping event loops busy after a file finishes.

## Verification

Run the full suite 5× on an unchanged commit; zero failures. A `--repeat` run in CI would keep it honest.
