---
id: review-findings
priority: P1
area: all
status: triaged
package: monorepo
title: Triaged review findings — three parallel audits (Phase 0 impl, design docs, test code)
---

## Summary

Three review agents ran in parallel against the work landed in Phase 0:
1. **Phase 0 implementation review** — turbo.json, package.json changes, tools/* configs, CI workflow, .npmrc
2. **Design docs review** — cross-system-sync.md, client-sdk-token-handling.md, migration-v1-to-v2.md, task-tracker.md
3. **Test code review** — first vitest test file (jwt-utils.test.ts) as the template for all future tests

Findings consolidated below with **status** (`fixed` / `tracked` / `defer-to-task` / `wontfix`) and the action plan. Items marked `tracked` are slipped into existing tasks; `defer-to-task` means a follow-up task was added to the tracker.

---

## P0 / P1 — Fixed in this pass

| Finding | Source | Fix |
|---|---|---|
| Test time-flake risk (`PAST`/`FUTURE`/`NEAR` at module-import time) | test-review | Computed inline per-test via `now()` helper |
| Missing JWT test cases (TC-481c, TC-482c/d, TC-484c) | test-review | 4 new tests added (total 22 pass) |
| `makeJwt` helper not shared → other tests will duplicate | test-review | Extracted to `test/fixtures/jwt.fixtures.ts` |
| Stale `packages/nest-auth/ui/` path references in AGENTS.md | phase0-review §10.5 | Will fix in this pass below |
| Tracker T-040 self-dependency typo | docs-review §4.1 | Will fix below |
| Tracker missing T-057 → T-024 transitive edge | docs-review §4.1 | Will fix below |
| `build:legacy` script duplicates turbo path | phase0-review §2.1 | Will remove below |
| Migration guide doesn't mention `ReversalService` | docs-review §3.1 | Will add below |

---

## P1 — Tracked / deferred to specific tasks

These need real work but slot into existing tracker items rather than being addressed inline:

| Finding | Source | Lands in task |
|---|---|---|
| Hook execution isolation level not specified | docs-review §1.1 | **T-054b** — add isolation note (READ COMMITTED default per Postgres) |
| Saga compensation failure tracking → `OutOfBandRollbackRequiredEvent` payload shape | docs-review §1.1 | **T-054e** — payload spec part of impl |
| Saga nested compensations | docs-review §1.2 | **T-054e** — explicit "no nesting in v2; saga at boundary only" |
| Long-running hooks (multi-second external calls) decision tree | docs-review §1.2 | **T-054a** — extend hook docs |
| Concurrent hooks (two plugins same event) merge strategy | docs-review §1.2 | **T-054a** — declared `priority` field + tracker note |
| Hook vs. event ordering on delete | docs-review §1.2 | **T-054b** — documented invariant: hooks run pre-commit, events post-commit |
| Outbox `id` stability for idempotency | docs-review §1.2 | **T-054d** — use UUIDv7 as primary key |
| `getAuthHeadersSync()` null on RN — sync read impossible | docs-review §2.1 | **T-167a** — handled in current impl: returns null + async path |
| SSE / WebSocket transport not covered | docs-review §2.1 | **NEW T-167e** — add `getAuthForUrl()` for URL-embedded token transport |
| Multi-axios instances (some auth, some not) leakage warning | docs-review §2.1 | **T-167c** — `attachToAxios` is opt-in per instance + doc warning |
| 401 retry infinite loop on refresh-itself-401 | docs-review §2.1 | **T-167c** — bounded retry, default max 1 (already in `retryTracker`) |
| Cookie `SameSite=Strict` + cross-origin warning | docs-review §2.2 | **T-167c** — documented in attachToAxios JSDoc |
| SSR token handoff (server has no localStorage) | docs-review §2.2 | **T-167a** — `setTokens()` programmatically from server, mirror populates |
| `useAuthHeaderFn` unmount cleanup | docs-review §2.4 | **T-178a** — hook captures via `useRef`, no listener to clean |
| Migration guide: custom OAuth providers missing path | docs-review §3.2 | **T-150** — add §"Custom providers" |
| Migration guide: custom hooks/middleware path | docs-review §3.2 | **T-150** — add §"Custom transformers" |
| Migration guide: env var rename checklist | docs-review §3.4 | **T-150** — add §"Env var changes" |
| ISOLATED mode claim in present tense vs aspirational | docs-review §3.1 | Migration guide tagged "Planned for v2.0" until T-096 lands |
| `forRootLegacy` referenced before T-091 implemented | docs-review §3.1 | Migration guide marked draft; published only after T-091 |
| Effort estimates unvalidated | docs-review §4.1 | **NEW T-021a** — calibrate estimates after Phase 1 |
| No observability/metrics tasks | docs-review §4.2 | **NEW T-179a..d** — Phase 8: structured logging + Prometheus metrics + traces + SLO doc |
| No performance regression SLO | docs-review §4.4 | **T-194** — extend with explicit p99 thresholds (added below) |
| Vitest coverage thresholds not set | test-review §8 | **T-011a** — set thresholds when integration tests land (Phase 1) |
| Cross-package admin write (vite outDir) | phase0-review §1.1 | Already tracked in **T-109** (Phase 5) |
| ESLint config cache invalidation | phase0-review §4.3 | **NEW T-010a** — add `tools/eslint-config/**` to turbo lint inputs |
| Test infra helpers don't exist yet | phase0-review §10.3 | Tracked in **T-012..T-021** — Phase 1 |
| Missing WORKSPACE.md | phase0-review §10.1 | **NEW T-156a** — added to Phase 6 docs |

---

## P2 — Deferred (post-v2 or low-impact)

| Finding | Source | Disposition |
|---|---|---|
| Property-based testing with `fast-check` | test-review §3 | Post-v2.0 enhancement |
| AGENTS.md updates for old ui/ path | phase0-review §10.5 | Will fix below (quick) |
| Vitest `setupFiles` for global teardown | test-review §8 | Add when integration tests need it (Phase 1) |
| Plugin testing helper (`@ackplus/plugin-testing`) | docs-review §4.2 | Post-v2.0 (after first 3rd-party plugin appears) |
| `prepublishOnly` hook on root | phase0-review §2.3 | Will add below |
| `globalDependencies` explicit `tsconfig.base.json` | phase0-review §1.2 | Already covered via per-task `tsconfig*.json` input; doc-only |
| Workspace dependency: nest-auth-admin → nest-auth (build order via topology) | phase0-review §1.1 | Documented in `vite.config.ts` comments; Phase 5 cleanup |

---

## P3 — Won't fix / accept as-is

| Finding | Disposition |
|---|---|
| Test using hand-crafted JWT vs real backend-signed token | Acceptable — `decodeJwt` is a pure codec. Real-signed-token tests live at the integration layer (TC-400+) |
| Task IDs jumping non-sequentially across phases | Cosmetic; intentional gaps allow inserts |
| Numeric edge cases (year 2100 exp, leap seconds) | JS `Number` handles up to year 275760 — no real concern |

---

## Action plan (this pass)

1. Apply the 8 "Fixed in this pass" items below.
2. Add the 6 NEW tasks (`T-010a`, `T-011a`, `T-021a`, `T-167e`, `T-179a..d`, `T-156a`) to the tracker.
3. Continue execution: T-167a → T-167b → T-167c → T-178a + tests.
4. Reviewers will run again after T-167 series completes — they'll catch new findings against the new code.

---

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md), [`task-tracker.md`](task-tracker.md), [`cross-system-sync.md`](cross-system-sync.md), [`client-sdk-token-handling.md`](client-sdk-token-handling.md), [`migration-v1-to-v2.md`](migration-v1-to-v2.md), [`test-catalog.md`](test-catalog.md)
