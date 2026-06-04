# `.tasks/` — issue log

A flat directory of markdown files, one per known bug or unimplemented bit. Cheaper than a real issue tracker, lives in-repo, can be edited in the same PR that fixes the bug.

## Meta documents

These are not single tasks — they're reference documents that span many tasks.

| Doc | Purpose |
| --- | --- |
| [000-master-roadmap.md](000-master-roadmap.md) | v2.0 master roadmap — architecture refactor, plugin system, file restructure, test strategy, examples, docs. **Read first.** |
| [task-tracker.md](task-tracker.md) | All 207 tasks (T-NNN ids), grouped by phase, with effort estimates, dependencies, and verification tests. **This is the execution doc.** |
| [test-catalog.md](test-catalog.md) | ~520 test cases (TC-NNN ids) across all four packages, real-test-only policy. |
| [monorepo-and-deployment.md](monorepo-and-deployment.md) | Phase 0: monorepo audit (Turborepo, embedded-UI extraction, configs, strict TS) + Vercel/Railway deployment plan for examples. |
| [cross-system-sync.md](cross-system-sync.md) | Design: how consumer apps keep their tables in sync with nest-auth across API, OAuth, admin dashboard, and plugins. Defines four sync patterns (hook / event / plugin / outbox), the canonical-event invariant, and **rollback/saga semantics** for multi-system flows. |
| [client-sdk-token-handling.md](client-sdk-token-handling.md) | Design: proper architecture for sharing the access token with consumer-app HTTP clients. Defines `attachToAxios`/`attachToFetch` helpers, `useAuthHeaderFn` stable-ref hook, and identifies the 6 defects in v1 that forced the user's patch. |
| [react-native-and-social-login.md](react-native-and-social-login.md) | Design: social-login SDK helpers (web + native) and a `@ackplus/nest-auth-react-native` package with native Google/Apple/Facebook auth. Phase 10 tasks (RN-1..RN-17) + test cases (TC-RN-*). |
| [compliance-and-healthcare.md](compliance-and-healthcare.md) | Internal compliance gap-plan + HIPAA depth. Universal posture (anchored on OWASP ASVS L2 + NIST 800-63B AAL2, mapped to SOC 2 / ISO 27001 / PCI-DSS / GDPR / DPDP / HIPAA / PSD2). Grounded current-state, gap list with severity, Phase 11 tasks (CMP-*), the `compliance` preset, shared-responsibility model. **Consumer-facing posture statement:** `apps/docs/content/docs/production/compliance.mdx`. |
| [migration-v1-to-v2.md](migration-v1-to-v2.md) | Customer-facing migration guide for the v1.x → v2.0 major bump. Step-by-step, before/after code, schema migration plan, rollback procedure. Draft until v2.0 GA. |
| [audit-types.md](audit-types.md) | Type/enum duplication audit across packages. |

## Conventions

- **Filename:** `NNN-short-slug.md`. Three-digit zero-padded id, kebab-case slug.
- **Frontmatter (required):** `id`, `priority`, `area`, `status`, `package`, `title`.
- **Sections (in order):** `## Summary`, `## Where` (file:line refs), `## Impact`, `## Fix` (or `## Fix hypothesis`), `## Verification`. Optional: `## Related`.
- **Status values:** `open` · `in-progress` · `fixed` (keep the file; flip the status). Don't delete fixed tasks — they're useful as audit trail.
- **Priority:**
  - `P0` — security or "feature is broken"
  - `P1` — real bug, no immediate impact
  - `P2` — paper cut, missing config, inconsistent behaviour
  - `P3` — nice-to-have, cleanup
- **Tenant-flow tasks** carry an extra `mode:` frontmatter field (`disabled` / `shared` / `isolated` / `cross-mode`) so a focused fix can scope to one mode at a time.

## Index

### Open

| ID | P | Area | Title |
| --- | --- | --- | --- |
#### P0 — security / feature broken

| ID | Area | Title |
| --- | --- | --- |
| [019](019-isolated-mode-not-actually-isolated.md) | backend / `mode: isolated` | ISOLATED tenant mode is currently a no-op — code does not honour the contract |

#### P1 — real bug

| ID | Area | Title |
| --- | --- | --- |
| [006](006-build-sql-snapshots-script-is-stub.md) | docs | `build-sql-snapshots.ts` is a stub — Database Setup page links to placeholder SQL |
| [007](007-admin-controllers-missing-api-response-decorators.md) | backend | AdminUsersController endpoints have no `@ApiResponse` decorators |
| [010](010-social-providers-skipmfa-inconsistent.md) | backend | Social providers inconsistently set `skipMfa` |
| [013](013-no-test-coverage-on-any-package.md) | all | No automated test coverage on any of the four packages |
| [020](020-refresh-after-switchtenant-fragility.md) | backend / `mode: shared` | Refresh after `switchTenant` relies on `session.data` persistence — silent regression risk |
| [021](021-user-email-not-unique-at-db-layer.md) | backend / `mode: shared` | `nest_auth_users.email` is `@Index` only, not `@Unique` — *deferred*, see file for tradeoff |

#### P2 — paper cuts / inconsistencies

| ID | Area | Title |
| --- | --- | --- |
| [016](016-openapi-spec-no-servers-and-no-tags.md) | backend | OpenAPI spec has empty `servers[]` and missing top-level `tags[]` |
| [022](022-sessions-tenantid-not-a-column.md) | backend / `mode: shared` | `nest_auth_sessions.tenantId` lives inside the JSON `data` column |

#### P3 — nice-to-haves

| ID | Area | Title |
| --- | --- | --- |

### Fixed

| ID | P | Area | Title | Date |
| --- | --- | --- | --- | --- |
| [001](001-admin-password-validation-bypassed.md) | P0 | backend | Admin login bypasses password validation | 2026-04-27 |
| [002](002-plaintext-password-logged.md) | P0 | backend | Plaintext admin password logged to stdout | 2026-04-27 |
| [003](003-email-provider-returns-email-as-userid.md) | P1 | backend | `EmailAuthProvider.validate()` returns email in the userId field | 2026-04-27 |
| [004](004-phone-provider-returns-phone-as-userid.md) | P1 | backend | `PhoneAuthProvider.validate()` returns phone in the userId field | 2026-04-27 |
| [008](008-session-onrevoked-hardcoded-reason.md) | P2 | backend | SessionManagerService passes hardcoded `'admin'` reason to `onRevoked` hook | 2026-04-27 |
| [009](009-session-touch-interval-hardcoded.md) | P2 | backend | Session "touch" interval is hardcoded to 5 minutes (now configurable) | 2026-04-27 |
| [011](011-google-email-verified-check-disabled.md) | P2 | backend | Google `email_verified` gate + `*VerifiedAt` lift on Google / GitHub / passwordless / MFA-OTP | 2026-04-27 |
| [012](012-github-provider-error-swallowing.md) | P2 | backend | `GitHubAuthProvider` differentiates failure modes (network / 4xx / 5xx / no-public-email) | 2026-04-27 |
| [014](014-otp-input-skipdefaultstyles-deprecation.md) | P3 | backend | `otp-input` `skipDefaultStyles` prop now `@deprecated` and pinned to v3.0.0 | 2026-04-27 |
| [015](015-typedoc-warning-unused-jsdoc-params.md) | P3 | backend | TypeDoc unused-`@param` warnings cleaned up | 2026-04-27 |
| [017](017-switchtenant-no-mode-guard.md) | P1 | backend / `mode: cross-mode` | `POST /auth/switch-tenant` mode + membership guards | 2026-04-27 |
| [018](018-disabled-mode-silently-discards-tenantid.md) | P2 | backend / `mode: disabled` | Disabled-tenant mode now rejects `tenantId` in signup/login | 2026-04-27 |
| [023](023-current-tenant-decorator-undocumented-disabled-behavior.md) | P3 | backend / `mode: disabled` | `@CurrentTenantId()` JSDoc rewritten to clarify `null` cases | 2026-04-27 |
| [024](024-mfa-not-tenant-scoped-design-undocumented.md) | P3 | backend | MFA tenant-scope behaviour documented in concepts/mfa.mdx | 2026-04-27 |
| [005](005-build-openapi-script-is-stub.md) | P0 | docs | `build-openapi.ts` now invokes the real generator (T-024) | 2026-05-21 |

### Deferred

| ID | P | Area | Title | Reason |
| --- | --- | --- | --- | --- |
| [021](021-user-email-not-unique-at-db-layer.md) | P1 | backend / `mode: shared` | `nest_auth_users.email` per-mode unique constraint | A simple `@Unique` would break ISOLATED mode (where the same email can exist once per tenant) since `tenantId` is on `user_access`, not on the user table. API-level check already covers normal traffic. Re-open alongside #022 schema rework. |

## Suggested order

Security & quick wins first, then unblockers, then bigger-lift items.

1. **#013** — set up the test scaffold (vitest or jest). Everything below benefits from having tests as you go.
2. **#005** — wire up the real OpenAPI generator. Unblocks #007 and #016.
3. **#019** — decide on ISOLATED mode. Either rename to STRICT and document that tenantId is just a tag, or commit to a per-DB lift. Bigger; needs an RFC.
4. **#020 / #022** — session refresh hardening + `tenantId` as a column. Often paired in one PR. Reopens #021 once `tenantId` is on the user table.
5. **#010** — social-providers `skipMfa` consistency.
6. **#007 / #016** — once #005 lands.
7. **#006** — SQL snapshots, makes the Database Setup page actually work.

## By tenant mode

If you're only working on one mode, here's the slice:

| Mode | Open issues |
| --- | --- |
| `disabled` | — (all caught up) |
| `shared` | #020, #022 (#021 deferred) |
| `isolated` | #019 |
| `cross-mode` (any tenant config) | — |

## Adding a new task

1. Find the next free ID.
2. `cp .tasks/_template.md .tasks/NNN-short-slug.md` (template not yet created — copy any existing file as a starter).
3. Fill in the frontmatter and the four required sections.
4. Add a row to this README under "Open".
5. Optional: open a corresponding GitHub issue and link it in the file.

## Closing a task

1. In the PR that fixes it, flip `status: open` → `status: fixed` in the file's frontmatter.
2. Move its row from the "Open" table to the "Fixed" section in this README.
3. Don't delete the file.
