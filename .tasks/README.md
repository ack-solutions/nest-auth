# `.tasks/` — issue log

A flat directory of markdown files, one per known bug or unimplemented bit. Cheaper than a real issue tracker, lives in-repo, can be edited in the same PR that fixes the bug.

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
| [001](001-admin-password-validation-bypassed.md) | backend | Admin login bypasses password validation |
| [002](002-plaintext-password-logged.md) | backend | Plaintext admin password logged to stdout |
| [005](005-build-openapi-script-is-stub.md) | docs | `build-openapi.ts` is a stub — OpenAPI spec is hand-maintained |
| [019](019-isolated-mode-not-actually-isolated.md) | backend / `mode: isolated` | ISOLATED tenant mode is currently a no-op — code does not honour the contract |

#### P1 — real bug

| ID | Area | Title |
| --- | --- | --- |
| [003](003-email-provider-returns-email-as-userid.md) | backend | EmailAuthProvider.validate() returns email in the userId field |
| [004](004-phone-provider-returns-phone-as-userid.md) | backend | PhoneAuthProvider.validate() returns phone in the userId field |
| [006](006-build-sql-snapshots-script-is-stub.md) | docs | `build-sql-snapshots.ts` is a stub — Database Setup page links to placeholder SQL |
| [007](007-admin-controllers-missing-api-response-decorators.md) | backend | AdminUsersController endpoints have no `@ApiResponse` decorators |
| [010](010-social-providers-skipmfa-inconsistent.md) | backend | Social providers inconsistently set `skipMfa` |
| [013](013-no-test-coverage-on-any-package.md) | all | No automated test coverage on any of the four packages |
| [017](017-switchtenant-no-mode-guard.md) | backend / `mode: cross-mode` | `POST /auth/switch-tenant` has no guard for tenant mode — accepts calls in any configuration |
| [020](020-refresh-after-switchtenant-fragility.md) | backend / `mode: shared` | Refresh after `switchTenant` relies on `session.data` persistence — silent regression risk |
| [021](021-user-email-not-unique-at-db-layer.md) | backend / `mode: shared` | `nest_auth_users.email` is `@Index` only, not `@Unique` — concurrent-signup race |

#### P2 — paper cuts / inconsistencies

| ID | Area | Title |
| --- | --- | --- |
| [008](008-session-onrevoked-hardcoded-reason.md) | backend | SessionManagerService passes hardcoded `'admin'` reason to `onRevoked` hook |
| [009](009-session-touch-interval-hardcoded.md) | backend | Session "touch" interval is hardcoded to 5 minutes |
| [011](011-google-email-verified-check-disabled.md) | backend | Google access-token flow has `email_verified` check commented out |
| [012](012-github-provider-error-swallowing.md) | backend | `GitHubAuthProvider` catch block swallows the failure mode |
| [016](016-openapi-spec-no-servers-and-no-tags.md) | backend | OpenAPI spec has empty `servers[]` and missing top-level `tags[]` |
| [018](018-disabled-mode-silently-discards-tenantid.md) | backend / `mode: disabled` | Disabled-tenant mode silently discards `tenantId` in signup/login |
| [022](022-sessions-tenantid-not-a-column.md) | backend / `mode: shared` | `nest_auth_sessions.tenantId` lives inside the JSON `data` column |

#### P3 — nice-to-haves

| ID | Area | Title |
| --- | --- | --- |
| [014](014-otp-input-skipdefaultstyles-deprecation.md) | backend | `otp-input` `skipDefaultStyles` prop marked for removal without version pin |
| [015](015-typedoc-warning-unused-jsdoc-params.md) | backend | TypeDoc warns about JSDoc `@param` references to unused parameters |
| [023](023-current-tenant-decorator-undocumented-disabled-behavior.md) | backend / `mode: disabled` | `@CurrentTenantId()` returns `null` in disabled mode without JSDoc clarifying it |
| [024](024-mfa-not-tenant-scoped-design-undocumented.md) | backend / `mode: shared` | MFA secrets and trusted devices are user-global, not tenant-scoped — undocumented |

### Fixed

_(none yet)_

## Suggested order

Security & quick wins first, then unblockers, then bigger-lift items.

1. **#001 + #002** — admin-console security. Same file, same PR. ~10 lines of code; writing the test is the harder part.
2. **#003 + #004** — provider userId bug. Same trivial diff, same test.
3. **#017** — `switchTenant` mode guard. ~30 lines, knocks out one of the most user-facing tenant bugs.
4. **#021** — add the unique constraint on `nest_auth_users.email` / `phone`. Migration required; test the race.
5. **#013** — set up the test scaffold (vitest or jest). Everything below benefits from having tests as you go.
6. **#005** — wire up the real OpenAPI generator. Unblocks #007 and #016.
7. **#006** — SQL snapshots, makes the Database Setup page actually work.
8. **#019** — decide on ISOLATED mode (rename to STRICT + add row-level enforcement, or commit to per-DB lift). Bigger; needs an RFC.
9. **#020 / #022** — session refresh hardening + `tenantId` as a column. Often paired in one PR.
10. The rest in priority order.

## By tenant mode

If you're only working on one mode, here's the slice:

| Mode | Open issues |
| --- | --- |
| `disabled` | #018, #023 |
| `shared` | #017, #020, #021, #022, #024 |
| `isolated` | #019 |
| `cross-mode` (any tenant config) | #017 |

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
