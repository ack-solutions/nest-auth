---
id: task-tracker
priority: P0
area: all
status: open
package: monorepo
title: Master task tracker — every task to ship v2.0 (100% bug-free, reliable, customizable, well-documented)
---

## Summary

Single source of truth for **every** task required to ship `nest-auth` v2.0 with the quality bar of "100% bug-free, reliable, customizable, well-documented." 207 tasks total, grouped by phase.

Read [`000-master-roadmap.md`](000-master-roadmap.md) first for the why; this file is the what.

---

## Bugs found & fixed during test authoring (real tests, no mocks)

The no-mock policy paid off immediately — writing real tests against a real DB surfaced **9 real bugs** that mocked tests would have hidden. All fixed:

| # | Bug | File | Found by |
|---|---|---|---|
| B-1 | `hasAnyAccess({roles: undefined})` coerced to `[undefined]` (length 1) not `[]` → broke "no requirements = allow" | `nest-auth-client/src/utils/role-utils.ts` | role-utils.test.ts |
| B-2 | `hasAllAccess` — same coercion bug | same | role-utils.test.ts |
| B-3 | `NestAuthTrustedDevice.revokedAt: Date \| null` → decorator metadata emitted `Object`, broke TypeORM under sqljs/sqlite | `nest-auth/src/lib/auth/entities/trusted-device.entity.ts` | bootTestApp smoke |
| B-4 | Newer esbuild (≥0.27) rejected type-only names in `export {}` blocks | `nest-auth-contracts/src/index.ts` | full-workspace build |
| B-5 | `emailAuth`/`phoneAuth` not enabled → cryptic `PROVIDER_NOT_FOUND` on phone signup/any login | test config default (`bootTestApp`) | signup TC-006 |
| B-6 | `passwordHash` (`select: false`) not loaded by `findIdentity`; brittle `BaseEntity.createQueryBuilder` fallback returned false → every login 401 | `nest-auth/src/lib/core/providers/email-auth.provider.ts` | login TC-030 |
| B-7 | **`AuthService.login` called `findIdentity(userId)` (expects providerId/email) instead of `findIdentityByUserId(userId)` — login broken for ALL consumers since `.tasks/003` fix** | `nest-auth/src/lib/auth/services/auth.service.ts` | login TC-030 |
| B-8 | Phone-auth provider had the same `select: false` passwordHash issue (preemptive fix) | `nest-auth/src/lib/core/providers/phone-auth.provider.ts` | symmetric with B-6 |
| B-9 | `PasswordService.changePassword` used `relations: ['roles']` (no such relation on `NestAuthUser`) → 500; also didn't select `passwordHash` | `nest-auth/src/lib/auth/services/password.service.ts` | change-password TC-165 |
| B-10 | Passwordless provider returned `userId: providerUserId` (the email) instead of the user UUID → `AuthService.login`'s `findIdentityByUserId` got an email → 401 | `nest-auth/src/lib/core/providers/passwordless-auth.provider.ts` | passwordless TC-045 |
| B-11 | Passwordless `findIdentityByUserId` inherited base filter `provider: 'passwordless'`, but passwordless users have `email`/`phone` identity rows → lookup returned null → 401 | same | passwordless TC-045 |

**B-7, B-10, B-11, B-13 are the headline** — between them, **email/phone login, passwordless login, AND MFA-challenge login were all completely broken** for every consumer, and no mocked test would ever have caught them (a mock would stub the repository/DTO to succeed regardless). This is the entire argument for the no-mock policy, proven four times over.

| B-12 (security) | **FIXED** — API-key `privateKey` was stored in **plaintext** and compared with `===`. Now stored as a domain-separated SHA-256 hash; `validateAccessKey` recomputes the hash and compares with `crypto.timingSafeEqual`. Plaintext returned to caller exactly once at creation. **Breaking: existing keys must be regenerated** (legacy plaintext rows fail validation gracefully → false). | `nest-auth/src/lib/user/services/access-key.service.ts` | access-keys tests (new B-12 test asserts stored ≠ plaintext, ≠ publicKey, is 64-char hex) |
| B-13 | **MFA login completely broken** — `NestAuthVerify2faRequestDto.trustDevice` had `@ApiProperty` but **no class-validator decorators**, so under `whitelist: true` the field was non-whitelisted and `forbidNonWhitelisted` made `POST /auth/mfa/verify` return 400 for *every* request. MFA-enabled users could log in (pending token) but **never complete the second factor → permanently locked out**. Added `@IsOptional() @IsBoolean()`. | `nest-auth/src/lib/auth/dto/requests/verify-2fa.request.dto.ts` | mfa-login-challenge test (TC-095) |

Current test count: **207 passing** (132 client + 75 backend) + 1 skipped sentinel ([`.tasks/021`](021-user-email-not-unique-at-db-layer.md) deferred unique-constraint bug). Backend integration coverage now spans signup, login, password reset, email verification, account ops, RBAC guards, TOTP MFA setup, **full MFA login challenge (login→pending→verify→tokens)**, tenant modes (DISABLED/SHARED), passwordless, session revocation, admin console (signup/login/me), API keys, and GitHub OAuth (auto-create, repeat-login same-user, email fallback, error paths). All 4 packages typecheck clean. **B-12 (API-key plaintext) is FIXED** (hashed + timing-safe).

**Customization wins shipped:** GitHub OAuth endpoint URLs (`github.userApiUrl` / `github.emailsApiUrl`) are now configurable — supports GitHub Enterprise, corporate proxies, and tests. **Confirmed via real OAuth test that social login works end-to-end** (`handleSocialLogin` fallback correctly resolves the user from the provider's external id; the earlier B-13 concern was a false alarm). Same pattern can extend to Google/Facebook URLs in follow-up.

---

## How to use

- **Task ID**: stable `T-NNN`. Use in PR titles (`T-042: ...`) and commit messages.
- **Verifies**: which `TC-NNN` tests from [`test-catalog.md`](test-catalog.md) prove the task is done.
- **Depends**: tasks that must complete first.
- **Status**: `open` · `in-progress` · `done` · `deferred` · `blocked`.
- When a task is non-trivial (M/L/XL), it gets its own `.tasks/NNN-*.md` deep-dive file when work starts.

### Effort legend

| Code | Wall-clock | Notes |
|---|---|---|
| XS | < 1 day | Trivial; single PR |
| S | 1-2 days | One PR |
| M | 3-5 days | One PR, larger |
| L | 1-2 weeks | Multiple PRs |
| XL | 2-4 weeks | Multiple PRs, possibly RFC |

### Definition of done for v2.0

The release ships when **all** of these are true:

1. Every `T-NNN` marked `done` or explicitly `deferred-v3`.
2. Every `TC-NNN` in [`test-catalog.md`](test-catalog.md) passes in CI.
3. Coverage thresholds met: contracts 100% (tsc), backend ≥85% line, client ≥90%, react ≥80%, admin ≥70%.
4. **No mocks** anywhere — grep for `vi.mock(`, `jest.mock(`, `MockRepository`, `MockUserService` returns zero hits.
5. OpenAPI spec generated from live backend, passes Spectral lint, embedded in docs via Scalar.
6. `npm audit` clean (no high/critical).
7. OWASP ZAP baseline scan passes against `example-nest` deployed to Railway.
8. Every built-in plugin has its own `AGENTS.md` + `README.md`.
9. `llms.txt` present at repo root and per package.
10. 9 example apps deploy from a single `git push` (per [`monorepo-and-deployment.md`](monorepo-and-deployment.md)).
11. Three production consumers have migrated from v1.x to v2.0 and signed off.

---

## Phase 0 — Monorepo Foundation (10 tasks)

**Goal:** clean repo plumbing so every later phase is easier. Do this first. **3-5 days for one engineer.**

| ID | Task | Effort | Status | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|---|
| T-001 | Add Turborepo + `turbo.json` with build/test/lint/typecheck/dev tasks | XS | **done** (2026-05-21) | — | — | `pnpm turbo run build` builds all packages with caching — verified: 12.6s cold → 33ms full-cache hit across 4 library packages |
| T-002 | Extract `packages/nest-auth/ui/` → `packages/nest-auth-admin/`; remove `yarn.lock` + `package-lock.json`; package renamed to `@ackplus/nest-auth-admin`; contracts dep changed from `file:../` to `workspace:*`; `npm --prefix` postinstall hack removed; missing `lodash` dep added (was hidden by old npm install); swagger generator path updated; turbo task ordering ensures admin builds after nest-auth | S | **done** (2026-05-21) | T-001 | — | Single lockfile; all 5 packages build via pnpm/turbo in 12.4s cold; 21 npm-vulnerability warnings gone |
| T-003 | Create `tools/tsconfig`, `tools/eslint-config`, `tools/prettier-config`, `tools/vitest-preset` workspace packages | S | **done** (2026-05-21) | T-001 | — | All 4 packages registered as workspace (`@ackplus/tsconfig`, `@ackplus/eslint-config`, `@ackplus/prettier-config`, `@ackplus/vitest-preset`); `tools/*` glob added to `pnpm-workspace.yaml`; turbo runs clean (44ms full-cache). Consumer migration is T-004 (tsconfig), T-009 (strict), T-011+ (vitest helpers). |
| T-004 | Add TypeScript Project References (`composite: true`) across all packages | S | T-003 | — | `tsc -b` from any package builds dependency graph |
| T-005 | Add Changesets (`.changeset/`); pin all 5 packages in a `fixed` version group | XS | **done** (2026-05-21) | T-001 | — | `pnpm changeset` available; `.changeset/config.json` with 4 publishable packages as fixed group, internal/private pkgs ignored |
| T-006 | Rename `apps/examples-next` → `apps/example-next`; fix `apps/example-nest` `package.json` name from `example-app` to `example-nest`; also fixed bad lint glob `apps/libs/` (M10) | XS | **done** (2026-05-21) | — | — | Folder + package names consistent; lockfile updated |
| T-007 | Pin Node `>=20.0.0`, add `.nvmrc` (20), `.npmrc` (`engine-strict=true`, `auto-install-peers=true`, public-hoist for types/eslint/prettier) | XS | **done** (2026-05-21) | — | — | `engines` field + dotfiles in place |
| T-008 | Standardize build with `tsup` for all library packages; consistent `package.json` `exports` map | S | open | T-004 | — | All packages produce CJS+ESM+`.d.ts` with same shape |
| T-009 | Turn on TS `strict: true` (+ `noUncheckedIndexedAccess`) in `tools/tsconfig/base.json`; fix per-package errors | M | open | T-003, T-004 | — | `pnpm typecheck` clean across repo |
| T-010 | Add `.github/workflows/ci.yml`: matrix build + test + lint on Node 20 & 22 | XS | **done** (2026-05-21) | T-001 | — | CI runs on PR + push-to-main; concurrency cancel for prev runs; turbo cache restore; typecheck/lint soft-fail until T-009; changeset-presence check |

---

## Phase 1 — Test Infrastructure (15 tasks)

**Goal:** make every later phase verifiable. **Real-test-only policy** (no mocks of internal classes). **1-2 weeks.**

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-011 | Add Vitest + `vitest.config.ts` template in `tools/vitest-preset`; pilot in `nest-auth-client` with first 18 real tests (TC-480 to TC-484, jwt utilities) — proves no-mock policy works | XS | **done** (2026-05-21) | T-003 | TC-480, TC-481, TC-482, TC-483, TC-484 | `pnpm -F @ackplus/nest-auth-client test` runs 18 tests in 3ms; turbo orchestrates with full-cache 52ms |
| T-012 | Add `@testcontainers/postgresql` boot helper in `tools/vitest-preset` | S | **done** (2026-05-21) | T-011 | TC-001+ | `setupPostgresContainer()` with auto `beforeAll`/`afterAll`, `truncateAll()`, `connectionString()`. Requires Docker (CI). |
| T-013 | Add `@testcontainers/redis` boot helper | XS | **done** (2026-05-21) | T-012 | TC-133 | `setupRedisContainer()` with `flushAll()`. Same lifecycle pattern as Postgres. |
| T-014 | Build `bootTestApp()` helper — real `Test.createTestingModule + app.init()` returning `INestApplication` | S | **done** (2026-05-21) | T-012 | TC-001+ | Real NestJS app via `@nestjs/testing`. Supports sqljs (no Docker), sqlite, postgres. Smoke test (3 cases) proves the full stack works in-memory. Fixed `NestAuthTrustedDevice.revokedAt` Object-type bug + contracts esbuild type-export issue while landing. |
| T-015 | Build OAuth stub server (real Node `http` server, random port) implementing Google/GitHub/Facebook response shapes | S | **done** (2026-05-21) | T-014 | TC-060+ | `setupOAuthStubServer()` in `tools/vitest-preset/helpers/oauth-stub-server.js`. Per-provider fixture setters, request log for assertions, auto `beforeAll`/`afterAll`. Awaits Phase 2 URL-override config on the OAuth providers to be exercised end-to-end. |
| T-016 | Implement `EmailCaptureTransport` (real `EmailSender` impl writing to in-memory store) | XS | T-014 | TC-160, TC-180+ | Assert on captured emails |
| T-017 | Implement `SmsCaptureTransport` (real `SmsSender` impl writing to in-memory store) | XS | T-014 | TC-046, TC-098 | Assert on captured SMS |
| T-018 | Add `@sinonjs/fake-timers` integration + helper for narrow expiry tests | XS | T-014 | TC-040, TC-093 | Advance clock without mocking `Date` |
| T-019 | Build entity fixtures + factories under `test/fixtures/` using `@faker-js/faker` (real DB inserts) | S | T-014 | TC-* | One-line scenario setup |
| T-020 | Build pre-built scenarios under `test/scenarios/` (multi-tenant, MFA-enrolled, OAuth-linked user) | XS | T-019 | — | Scenarios composable in tests |
| T-021 | Build `bootClientAgainstBackend()` helper — boots real backend in-process, returns configured `AuthClient` | S | T-014 | TC-400+ | Client tests use real HTTP, not msw |
| T-022 | React test setup: jsdom + `@testing-library/react` + helper that wraps in `AuthProvider` w/ real client | S | T-021 | TC-600+ | Component tests render with real auth state |
| T-023 | Playwright setup for E2E in `apps/example-next` + admin UI | M | T-014, Phase 5 partial | TC-800+ | Full user journeys + admin flows automated |
| T-024 | Real OpenAPI generator: boot NestAuthModule in-memory → `SwaggerModule.createDocument()` → write to 4 destinations. Closes [`.tasks/005`](005-build-openapi-script-is-stub.md) | S | **done** (2026-05-21) | T-014 | TC-365 | `apps/docs/scripts/build-openapi.ts` now invokes existing `packages/nest-auth/script/generate-nest-auth-swagger.mjs`. Verified end-to-end. |
| T-025 | Spectral OpenAPI lint in CI; fix existing spec warnings | XS | T-024 | TC-915 | Bad spec changes fail CI |

---

## Phase 2 — Architecture Refactor (32 tasks)

**Goal:** split god-services, layer the code, eliminate `forwardRef`. **No new features.** **3-4 weeks.**

### 2.A — Create new structure (parallel to old)

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-026 | Create empty target folders (`core/`, `domain/`, `application/`, `http/`, `events/`, `hooks/`, `plugins/`) with `AGENTS.md` stub in each | XS | T-009 | — | Structure scaffolded; old code untouched |
| T-027 | Define `core/tokens.ts` — every public DI token (`PASSWORD_HASHER`, `SESSION_STORE`, `USER_REPOSITORY`, `EMAIL_SENDER`, `SMS_SENDER`, `OTP_CODEC`, `CLOCK`, sealed `JWT_SIGNER`/`SESSION_VALIDATOR`/`TENANT_GUARD`) | XS | T-026 | — | Tokens documented; sealed ones use `Symbol.for()` |

### 2.B — Move core (infrastructure)

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-028 | Move `AuthConfigService` → `core/config/`; add Zod validation of `IAuthModuleOptions` | S | T-026 | TC-360+ | Invalid config fails at boot with clear error |
| T-029 | Move `DebugLoggerService` → `core/logger/` | XS | T-026 | — | — |
| T-030 | Create `core/crypto/`: `BcryptHasher` bound to `PASSWORD_HASHER`; `JsonwebtokenSigner` bound to sealed `JWT_SIGNER`; `HmacOtpCodec` bound to `OTP_CODEC` | S | T-027 | TC-168, TC-200 | Default implementations live behind tokens |
| T-031 | Move `core/errors/`: `NestAuthError` base, error codes constant, `AuthExceptionFilter` | XS | T-026 | — | All thrown errors carry stable codes |
| T-032 | Move request-context middleware + decorators (`@CurrentUser`, `@CurrentTenantId`) to `core/request-context/` | XS | T-026 | TC-232 | Decorators work in any controller |
| T-033 | Add `core/clock/`: `Clock` interface bound to `CLOCK` token; default `SystemClock` | XS | T-027 | TC-018, TC-040 | Testable time |

### 2.C — Move domain

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-034 | Move `User` + `Identity` entities + repository interface + TypeORM adapter → `domain/user/` | S | T-026 | TC-001+ | `USER_REPOSITORY` token bound to TypeORM impl |
| T-035 | Move `Session` entity + repository + stores (DB/Redis/Memory) → `domain/session/` | S | T-026 | TC-132+ | `SESSION_STORE` token swaps backends |
| T-036 | Move `Role` + `Permission` entities + services → `domain/role/`, `domain/permission/` | XS | T-026 | TC-203+ | — |
| T-037 | Move `Tenant` + `UserAccess` entities + services → `domain/tenant/`; move strategy services (`disabled`/`shared`/`isolated` context) | S | T-026 | TC-230+ | Tenant context strategy interface clean |
| T-038 | Move `AuditLog` entity → `domain/audit/` | XS | T-026 | — | — |
| T-039 | Move pure utils (email normalizer, phone normalizer, cookie helper, timing-safe compare) → `utils/` | XS | — | — | Utils have zero DI |

### 2.D — Split AuthService into use-case services

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-040 | Extract `SignupService` from `AuthService` (target ≤300 LOC) | M | T-034, T-035, T-037 | TC-001-022 | All signup tests stay green |
| **T-040.pre** | First **11 signup integration tests pass** (TC-001..TC-007) via bootTestApp + supertest — before AuthService refactor | S | **done** (2026-05-21) | T-014 | TC-001-007 | Tests caught 4 real backend bugs: (1) emailAuth/phoneAuth not enabled in test defaults, (2) password hash not loaded on findIdentity (select:false), (3) AuthService.login used findIdentity instead of findIdentityByUserId — login broken since .tasks/003 fix, (4) NestAuthTrustedDevice.revokedAt Object-type column |
| T-041 | Extract `LoginService` | M | T-040 | TC-030-053 | — |
| T-042 | Extract `PasswordService` (change/forgot/reset) | S | T-040 | TC-160-171 | — |
| T-040.shared | Extract shared **`SessionTokenService`** (`getUserWithRoles`, `getUserWithAccess`, `generateTokensPayload`, `generateTokensFromSession`, `generateAuthResponse`) | S | **done** (2026-05-21) | T-040 | TC-001+,030+,120+ | 5 helpers → `session-token.service.ts`; AuthService delegates via facades. **AuthService 1196→1116 LOC.** No circular deps. 75 tests green. **Unblocks Refresh/Login/Signup.** |
| T-044 | Extract `LogoutService` | XS | **done** (2026-05-21) | T-040 | TC-127, TC-128 | `logout`/`logoutAll` → `logout.service.ts`; facade delegation. AuthService 1231→1196 LOC. Proves the pattern. |
| T-043 | Extract `RefreshService` | S | **unblocked** (next) | T-040.shared | TC-120-126 | Now unblocked — `refreshToken` can use `SessionTokenService`. One remaining shared helper to place: `ensureTenantAccess` (tenant-membership; `tenantContext`+`userService`) → small `TenantAccessService` or co-locate, then Refresh/Login/Signup follow the same facade pattern. |
| T-045 | Extract `VerificationService` (email + phone verification) | S | T-040 | TC-180-185 | — |
| T-046 | Extract `MfaService` per method (move into plugins in Phase 3) — for now, just isolate | S | T-040 | TC-090+ | — |
| T-047 | Leave `AuthService` as a thin facade (delegates to new services) for backward compat in v2.0 | XS | T-046 | — | Public API unchanged |

### 2.E — HTTP layer extraction

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-048 | Move controllers to `http/controllers/`; controllers are thin (parse DTO → call use case → return) | M | T-040 | TC-001+ | Each controller ≤200 LOC |
| T-049 | Move guards (`AuthGuard`, `RolesGuard`, `PermissionsGuard`, `RequireGuard`, `TenantGuard`) to `http/guards/` | S | T-026 | TC-200-215 | — |
| T-050 | Split `AdminUsersController` (21KB) → 4 controllers mirroring UI tabs | M | T-048 | TC-310+ | Each ≤300 LOC |
| T-051 | Move interceptors, filters, pipes to `http/` | XS | T-026 | — | — |
| T-052 | Move DTOs (requests + responses) to `http/dto/`; add missing `@ApiProperty`/`@ApiResponse`. Closes [`.tasks/007`](007-admin-controllers-missing-api-response-decorators.md), [`.tasks/016`](016-openapi-spec-no-servers-and-no-tags.md) | S | T-024 | TC-322 | OpenAPI spec is complete + lint-clean |

### 2.F — Strict events + hooks + transactions + indexes

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-053 | Strict-type the event bus: `AuthEventMap`, `EventBusService` wraps `EventEmitter2`, per-event payload types | S | T-026 | TC-341 | Listener autocompletion + payload type-check |
| T-053a | Define typed `AuthEventMap` in `nest-auth-contracts` covering 30+ events for user/role/tenant/session/identity/api-key (see [`cross-system-sync.md`](cross-system-sync.md) §"Same patterns, every entity") | S | T-026, T-053 | TC-341 | Every entity has typed create/update/delete events |
| T-053b | Lint rule + AST scan blocking direct `.save/.insert/.update/.delete/.softDelete` on `Repository<NestAuth*>` outside `application/` layer (enforces canonical-event invariant) | S | T-053 | TC-008a-c (per-source) | CI fails if admin controller or plugin writes directly to a NestAuth repository |
| T-054 | Type the hook registry: `HookRegistryService`, typed hook points (`beforeSignup`, `onLogin`, `transformResponse`, etc.) | S | T-026 | TC-340-348 | Hooks invoked at right lifecycle, payload typed |
| T-054a | Implement `UserHooks`/`RoleHooks`/`TenantHooks`/`SessionHooks` typed interfaces in contracts + registry wiring; hooks receive `ctx: { tx, source, actorId, tenantId, logger }` | M | T-054 | TC-008-012, TC-340-348 | Consumer can register typed `afterCreate` per entity |
| T-054b | Implement **transactional** hook execution — same `EntityManager` shared between auth write and hook bodies; hook throws → full rollback (see [`cross-system-sync.md`](cross-system-sync.md) Pattern 1) | S | T-054a | TC-010, new TC-cross-sync-1, TC-cross-sync-2 | DB shows no partial user when `afterCreate` throws |
| T-054c | Implement `@OnAuthEvent('user.created')` decorator — typed wrapper around `@OnEvent`, payload autocompletion in handler | XS | T-053a | — | Listener handlers fully typed |
| T-054d | Implement **outbox** mechanism (entity + poller + delivery) as a built-in plugin for at-least-once delivery to external systems (see [`cross-system-sync.md`](cross-system-sync.md) Pattern 4) | M | T-054b, T-085 | new TC-outbox-* | Webhooks plugin uses this; deliveries survive process crash |
| T-054e | Implement `Saga` primitive — ordered `do`/`compensate` steps, reverse-order rollback on failure, `OutOfBandRollbackRequiredEvent` when compensate fails. See [`cross-system-sync.md`](cross-system-sync.md) §"Rule 2 — saga" | M | T-054a | TC-rollback-2,3,6 | Multi-system signups (e.g. user + Stripe + CRM) can rollback explicitly |
| T-054f | Implement `ReversalService` — `deleteUser`/`deleteRole`/`deleteTenant` APIs that run full lifecycle (hooks + events + cascade) for post-commit rollback. See [`cross-system-sync.md`](cross-system-sync.md) §"Rule 4" | S | T-054a | TC-rollback-4 | Fraud-detection workflows can undo a user 30s after signup |
| T-055 | Wrap signup, role assignment, password reset, MFA enable in DB transactions | S | T-040 | TC-010, TC-214 | Mid-transaction failure rolls back fully |
| T-056 | Add compound unique index `(provider, providerId)` on `nest_auth_identities` | XS | — | TC-073 | Race condition on OAuth callback eliminated |
| T-057 | Migrate `sessions.tenantId` from JSON `data` column → real column with index. Closes [`.tasks/022`](022-sessions-tenantid-not-a-column.md) | S | T-035, T-024 | TC-139, TC-140 | Real SQL query works; old data backfilled; OpenAPI spec reflects new column |

### 2.G — Final cleanup

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-058 | Eliminate 18 `forwardRef` calls — move shared deps into `core/`, use event bus for cross-module signals | M | T-053 | — | `forwardRef` count ≤ 2; each remaining justified in a comment |
| T-059 | Delete old `src/lib/` structure; final import-path cleanup | S | All Phase 2 | — | `tsc --noEmit` clean; lint clean |

---

## Phase 3 — Plugin System (35 tasks)

**Goal:** every feature becomes a plugin. Consumers add new auth methods without forking. **2-3 weeks.**

### 3.A — Plugin core

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-060 | Implement `NestAuthPlugin` abstract class with full contract (id/version/coreVersion/dependsOn/conflictsWith/overrides/entities/providers/controllers/imports/migrations/authMethods/adminUI/errorCodes/lifecycle/events) | M | T-027 | TC-380-392 | Contract published in contracts pkg + docs |
| T-061 | Implement `PluginContext` — scoped DI handle (config view, eventBus, hookRegistry, logger prefix, core service handles) | S | T-060 | — | Plugins receive ctx in lifecycle hooks |
| T-062 | Implement `PluginRegistry`: dependency graph builder, Kahn topo sort, cycle detection, `conflictsWith` validation, `overrides[]` collision detection, sealed-token enforcement | M | T-061 | TC-380, TC-384, TC-386, TC-387, TC-390 | Bad plugin tree fails at boot with attribution |
| T-063 | Implement `PluginLoader`: materializes plugin instances into `DynamicModule` (entities → datasource, providers → flat list with overrides, controllers → registered) | M | T-062 | TC-381, TC-382, TC-388 | One unified `DynamicModule` produced |
| T-064 | Add `/auth/_meta` endpoint exposing plugin tree, version compatibility, override map (helpful for AI agents + debugging) | S | T-063 | TC-389 | JSON manifest viewable in browser |
| T-065 | Add diagnostic boot log: resolved plugin tree + override map + registered routes | XS | T-063 | — | Helps debug plugin issues |
| T-066 | Versioning enforcement: `semver.satisfies(CORE_VERSION, plugin.coreVersion)` at boot | XS | T-060 | TC-390 | Incompatible plugin fails with migration link |

### 3.B — Convert built-in features to plugins

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-067 | Convert email/password to `email-password` plugin (template for others) | S | T-063 | TC-001-053 | All signup/login tests green |
| T-068 | Convert phone/password to `phone-password` plugin | XS | T-067 | TC-006, TC-007, TC-039+ | — |
| T-069 | Convert magic-link to `magic-link` plugin | XS | T-067 | TC-042-044 | — |
| T-070 | Convert passwordless email to `passwordless-email` plugin | XS | T-067 | TC-045, TC-047, TC-048 | — |
| T-071 | Convert passwordless SMS to `passwordless-sms` plugin | XS | T-067 | TC-046, TC-097-098 | — |
| T-072 | Convert TOTP MFA to `mfa-totp` plugin (owns `mfa_secrets` entity) | S | T-067 | TC-090-096 | — |
| T-073 | Convert email OTP MFA to `mfa-email-otp` plugin | XS | T-072 | TC-097 | — |
| T-074 | Convert SMS OTP MFA to `mfa-sms-otp` plugin | XS | T-072 | TC-098 | — |
| T-075 | Convert recovery codes to `mfa-recovery-codes` plugin (proper schema, not single-string blob) | S | T-072 | TC-099, TC-100 | Recovery codes are individual rows with `usedAt` |
| T-076 | Convert trusted devices to `mfa-trusted-devices` plugin (owns `trusted_devices` entity) | S | T-072 | TC-101-103 | — |
| T-077 | Convert Google OAuth to `oauth-google` plugin | S | T-067 | TC-060-064 | — |
| T-078 | Convert GitHub OAuth to `oauth-github` plugin | XS | T-077 | TC-065-067 | — |
| T-079 | Convert Facebook OAuth to `oauth-facebook` plugin | XS | T-077 | TC-068 | — |
| T-080 | Convert Apple OAuth to `oauth-apple` plugin | XS | T-077 | TC-069 | — |
| T-081 | Build custom-OAuth helper: `defineOAuthPlugin({id, endpoints, profileExtractor})` for consumer use | S | T-077 | TC-070 | LinkedIn example uses this in <50 LOC |
| T-082 | Convert API keys to `api-keys` plugin (owns `api_keys` entity, guards, controller) | S | T-067 | TC-290-296 | — |
| T-083 | Build `organizations` (tenant) plugin — encapsulates DISABLED/SHARED/ISOLATED context strategies | M | T-067 | TC-230-277 | All three modes live in one plugin |
| T-084 | Build `audit-log` plugin — subscribes to all events, writes to `audit_logs` table | S | T-067 | TC-1056 | Audit log queryable by user/event/time |
| T-085 | **New** `webhooks` plugin — outbound delivery on configurable events with retry + HMAC signature | M | T-084 | TC-NEW | Consumer points webhooks at URL, receives signed deliveries |
| T-086 | Convert `rbac` to plugin (roles + permissions + guards) | S | T-067 | TC-200-215 | — |
| T-087 | Convert `admin-console` to plugin (still bundled by default) | M | All previous | TC-310-322 | Admin UI works through plugin manifest |

### 3.C — Client-side plugin support

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-088 | Define `ClientManifestEntry` schema (id, actions[{path, method, inputSchema, outputSchema}], events) | XS | T-060 | — | Zod schemas referenced |
| T-089 | Client SDK fetches `/auth/_meta` at init, generates typed RPC stubs via Zod | M | T-088, T-021 | TC-064+ | `client.oauthGoogle.start()` works without paired npm pkg |
| T-090 | Document Phase 2 path (paired npm packages, `$InferServerPlugin`) in plugin recipes | XS | T-089 | — | Migration story clear |

### 3.D — Legacy compatibility

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-091 | Build adapter layer: old `IAuthModuleOptions` config still works, translated to plugin list under the hood | S | T-067-T-086 | All TC-* | Existing v1.x users don't break in v2.0 minor |
| T-092 | Deprecation warnings on old config keys; deprecation guide written | XS | T-091 | — | Console warnings + migration page in docs |
| T-093 | Schedule removal: legacy config dropped in v3.0 | — | — | — | Document only |
| T-094 | Migration tool / CLI: `npx @ackplus/nest-auth-migrate` converts old config to plugin list | M | T-091 | — | Tool exists, tested on three example apps |

---

## Phase 4 — Multi-tenancy done right (14 tasks)

**Goal:** all three tenant modes do what the docs claim. Per-tenant config. **2-4 weeks.**

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-095 | RFC: ISOLATED mode decision (Option A: row-level fail-closed enforcement) per [`.tasks/019`](019-isolated-mode-not-actually-isolated.md) | S | — | — | RFC merged, design locked |
| T-096 | Implement ISOLATED mode: `IsolatedTenantContext` extends base with `assertTenantFilter()` that throws on queries missing `tenantId` | M | T-083, T-095 | TC-270-277 | Tenant A cannot read tenant B's rows even with a buggy query |
| T-097 | Add `tenantId` column to `mfa_secrets` (nullable in shared, required in isolated). Closes [`.tasks/024`](024-mfa-not-tenant-scoped-design-undocumented.md) | S | T-072 | TC-106, TC-275 | Per-tenant MFA in isolated mode |
| T-098 | Add `tenantId` column to `trusted_devices` | XS | T-076 | TC-276 | — |
| T-099 | Add `tenantId` column to `identities` | XS | T-034 | TC-274 | Same Google identity per tenant in isolated mode |
| T-100 | Harden `switchTenant`: explicit mode guard (rejects in DISABLED/ISOLATED), real membership check | S | T-083 | TC-253, TC-254 | Cannot switch to non-member tenant |
| T-101 | Harden refresh post-`switchTenant`: re-validate tenant membership on refresh, preserve tenant claim. Closes [`.tasks/020`](020-refresh-after-switchtenant-fragility.md) | S | T-100 | TC-124 | Refresh never loses tenant scope |
| T-102 | Build `nest_auth_tenant_configs` table + service: per-tenant overrides for auth methods enabled, password policy, MFA policy, session duration | M | T-083 | TC-NEW | Tenant A: email+google; Tenant B: SAML-only |
| T-103 | Admin UI: tenant config page per tenant | S | T-102, Phase 5 | — | Admin can toggle auth methods per tenant |
| T-104 | Reopen [`.tasks/021`](021-user-email-not-unique-at-db-layer.md) — add proper `(email, tenantId)` unique constraint in isolated mode | S | T-099 | TC-014, TC-022 | Concurrent signup race resolved at DB layer |
| T-105 | Add cross-tenant penetration test (sign token claiming tenant B with tenant A user → 403) | XS | T-100 | TC-277, TC-912 | Cross-tenant forgery blocked |
| T-106 | Audit: every query that should be tenant-scoped IS tenant-scoped (lint rule or runtime check) | M | T-096 | — | No query in codebase silently omits tenant filter |
| T-107 | Document multi-tenancy in `apps/docs/content/docs/concepts/multi-tenancy.mdx`: real worked example, mode comparison table, security implications | S | T-106 | — | Doc accurately describes implementation |
| T-108 | RFC-level placeholder: per-tenant physical DB isolation (Option B) → defer to v3 | XS | — | — | Issue filed for v3 milestone |

---

## Phase 5 — Admin UI Redesign (25 tasks)

**Goal:** production-grade admin. Customizable. White-labelable. **3-4 weeks.**

### 5.A — Foundation

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-109 | Set up `packages/nest-auth-admin/` independent build (Vite + React + MUI v7 + TS) | S | T-002 | — | Builds standalone via Turborepo |
| T-110 | Generate API client from OpenAPI spec (auto-typed; replaces hand-written `types/index.ts`) | S | T-024 | — | Type changes propagate from backend → admin |
| T-111 | Integrate TanStack Query — caching, dedup, refetch on focus, stale-while-revalidate | S | T-110 | — | Page transitions instant on cached data |
| T-112 | Replace custom `<Table>` with TanStack Table v8 — sorting, filtering, column visibility, row selection, virtualized rows | M | T-111 | TC-1002-1005 | Tables handle 100k rows smoothly |
| T-113 | Add `react-hot-toast` (or sonner) — global notification system | XS | — | — | Success/error/warning toasts everywhere |
| T-114 | Add `kbar` (or custom) — Cmd+K command palette | S | — | TC-1057 | All actions reachable via palette |
| T-115 | Define CSS-var theme tokens for white-labeling | XS | — | TC-1010 | Consumer can override brand colors via CSS |

### 5.B — User management rewrite

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-116 | User Detail page rewrite: 9 modals → single tabbed editable form with unsaved-changes guard | M | T-110, T-111 | TC-1007 | Admins stop complaining about "9 modals" |
| T-117 | Users list: bulk select + bulk actions (delete, role assign, enable/disable) | S | T-112 | TC-1005 | Bulk role assign of 1000 users in one action |
| T-118 | Users list: CSV export | XS | T-112 | TC-1058 | — |
| T-119 | Users list: advanced filters (date range, last login, MFA status, verified status, tenant, role) + save/load presets | S | T-112 | TC-1004 | — |
| T-120 | Admin impersonation: backend endpoint + UI button + audit log on enter/exit | S | T-117 | TC-1055 | Admins can debug as user; audit immutable |
| T-121 | Session list per user: view + selective revoke | S | T-116 | TC-1054 | Admin revokes one device, others stay |
| T-122 | MFA reset / regenerate recovery codes from admin UI | S | T-116 | TC-318 | Admin can rescue user locked out of TOTP |
| T-123 | Force password reset (sends reset email + invalidates current sessions) | XS | T-116 | TC-NEW | — |
| T-124 | Per-user audit log view (table of events for that user) | S | T-084 | TC-NEW | Helpful for support |

### 5.C — Roles, permissions, tenants

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-125 | Roles page: clone role, bulk-assign permission to N roles, role usage counter (how many users) | S | T-112 | TC-1052 | — |
| T-126 | Permissions page: bulk-assign to roles, show which roles use this | XS | T-112 | — | — |
| T-127 | Tenant Detail page with: member list, settings, branding section, per-tenant auth config (T-102/T-103) | M | T-102 | TC-1053 | Admin manages tenant end-to-end without leaving page |

### 5.D — Audit log + plugin pages + polish

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-128 | Global Audit Log page (filter by user/event type/time) | S | T-084 | TC-1056 | — |
| T-129 | Plugin manifest endpoint `GET /auth/admin/api/manifest` returning registered admin pages | XS | T-064 | TC-389 | Admin SPA renders plugin nav items |
| T-130 | Admin UI plugin loader: dynamic `import(bundleUrl)` for ESM-mode bundles + iframe for untrusted | M | T-129 | TC-389 | Third-party admin page works with SRI hash |
| T-131 | `registerAdminPage()`, `extendUserDetailTabs()`, `addTableAction()` host APIs | S | T-130 | — | Plugin authors use ergonomic API |
| T-132 | Keyboard shortcuts: g→u (go to users), g→r (roles), etc. | XS | T-114 | — | Quick navigation |
| T-133 | Dashboard rewrite: MFA adoption %, failed login chart, tenant growth, alerts (users without MFA, stale sessions) | S | T-128 | — | Useful overview, not just totals |

---

## Phase 6 — Examples + Docs (33 tasks)

**Goal:** docs reflect reality; examples cover every SDK touchpoint. Mostly parallelizable with Phase 5. **2-3 weeks.**

### 6.A — Example apps (9)

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-134 | Build `apps/example-nest-minimal` (~30-line setup, email+password only) | XS | Phase 3 | TC-800 | Smallest possible nest-auth example |
| T-135 | Build `apps/example-nest-full` — every built-in plugin enabled, all hooks/events demonstrated | M | Phase 3 | TC-800-814 | Reference for "can it do X?" |
| T-136 | Build `apps/example-nest-multitenant` — env-toggleable DISABLED/SHARED/ISOLATED | S | T-096 | TC-806, TC-807 | Real demo of all 3 modes |
| T-137 | Rebuild `apps/example-react` — every hook, every guard, complete login/signup/MFA/forgot-password/OAuth UI | M | T-022 | TC-800-805 | Frontend reference |
| T-138 | Rebuild `apps/example-next` — App Router + middleware + server actions | M | T-022 | TC-808-811 | Next.js reference |
| T-139 | Build `apps/example-vanilla` — plain HTML + ESM module | XS | Phase 3 | — | Framework-agnostic demo |
| T-140 | Build `apps/example-plugin-custom-oauth` — LinkedIn OAuth as a third-party plugin | M | T-081 | — | Plugin authoring tutorial |
| T-141 | Build `apps/example-plugin-extra-field` — profile photo + bio plugin with related entity | S | T-060 | — | Right way to extend user data |
| T-142 | (Optional) Build `apps/example-next-pages-router` — defer if no consumer | XS | T-022 | — | — |
| T-143 | Each example: README with screenshots + Stackblitz embed in docs | S | T-134-T-142 | — | Examples discoverable |
| T-144 | E2E test per example (Playwright); examples never silently rot | M | T-023 | TC-800-814, TC-1050-1058 | CI fails if example breaks |
| T-145 | Deploy backends to Railway, frontends to Vercel per [`monorepo-and-deployment.md`](monorepo-and-deployment.md) | S | T-094, T-145 | — | Live demo URLs in docs |

### 6.B — API reference rebuild

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-146 | Embed `@scalar/api-reference-react` in docs site at `/api-reference/`, sourced from live OpenAPI | S | T-024 | — | Search, "try it out", code samples in 10 languages |
| T-147 | Delete the 30 mechanical auto-generated MDX endpoint pages | XS | T-146 | — | Sitemap clean |
| T-148 | Document the Scalar embed pattern so consumers can run it against their own deployment | XS | T-146 | — | — |

### 6.C — Missing docs

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-149 | Write **Testing guide** — how to use `tools/vitest-preset`, no-mock policy, scenarios + factories | S | Phase 1 | — | Consumers write real tests for their plugins |
| T-150 | Write **Migration 1.x → 2.0 guide** — config changes, schema migrations, plugin adoption | S | T-094 | — | — |
| T-151 | Write **Security hardening** — JWT secret rotation, refresh rotation, CSP, CORS, MFA enforcement, rate limits | S | Phase 8 | — | Real production checklist |
| T-152 | Write **Admin console walkthrough** with screenshots + recording | S | Phase 5 | — | — |
| T-153 | Write **Multi-tenancy worked example** — full request trace, mode comparison, gotchas | S | T-107 | — | Replaces the misleading current doc |
| T-154 | Write **Writing a plugin** tutorial — quickstart, contract reference, 5 recipes | M | Phase 3 | — | Anyone can author a plugin in 1 hour |
| T-155 | Write **Overriding core services** — DI tokens, sealed core, decorator wrapping | S | T-060 | — | Power users understand override boundaries |

### 6.D — AI-agent docs

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-156 | Expand root `AGENTS.md` with extension recipes (add provider, add user field, add admin page) | S | — | — | — |
| T-157 | Per-folder `AGENTS.md` for `core/`, `domain/`, `application/`, `http/`, `plugins/` | S | Phase 2 | — | Agents know where to put things |
| T-158 | Per-built-in-plugin `AGENTS.md` (template for "follow this layout") | S | Phase 3 | — | — |
| T-159 | Add `llms.txt` at repo root + per package (machine-readable index of public exports, error codes, extension points) | S | Phase 3 | — | Agents can consume without parsing TS |
| T-160 | Export error codes as `const` (not just docs) from `nest-auth-contracts` | XS | T-031 | — | Clients match on stable constants |

### 6.E — Cleanup

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-161 | Fix stale README in `apps/example-react` (currently Vite template default) | XS | T-137 | — | — |
| T-162 | Fix stale README in `apps/example-nest` (links to non-existent paths) | XS | T-135 | — | — |
| T-163 | Add link-checker + prose-linter to CI | XS | — | — | Broken links fail CI |
| T-164 | Auto-generate SQL schema snapshots per dialect. Closes [`.tasks/006`](006-build-sql-snapshots-script-is-stub.md) | S | T-024 | — | Database Setup page shows real SQL |
| T-165 | Docs deploy preview per PR (Vercel) | XS | — | — | Reviewers see rendered docs |
| T-166 | Update `audit-types.md` items: remove duplicate `export *` in client (line 60), consolidate 3 `CookieOptions` definitions | XS | — | — | audit-types.md gaps closed |

---

## Phase 7 — Client SDK Quality (12 tasks)

**Goal:** SDK is production-quality, not just functional. Parallelizable with Phase 5/6. **1-2 weeks.**

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-167 | Split `AuthClient` (1067 LOC) into per-domain sub-clients: `passwordActions`, `mfaActions`, `oauthActions`, `sessionActions`, `tenantActions` | M | T-021 | TC-400-408 | Each ≤300 LOC |
| T-167a | **In-memory token mirror** in `TokenManager` (write-through to storage; sync read API). Fixes 1 of 6 defects from [`client-sdk-token-handling.md`](client-sdk-token-handling.md) | S | **done** (2026-05-21) | — | TC-token-6 + 14 new real tests | Mirror + `getAccessTokenSync`/`getRefreshTokenSync`/`getTrustTokenSync`/`getAuthorizationHeaderSync` + `ready()` warm-up. 36 total tests pass; covers sync/async storage adapters, cookie mode bypass, mode switching, storage-fallback warming. No mocks. |
| T-167b | Add `AuthClient.getAuthHeaders()` (async) and `getAuthHeadersSync()` (sync) — single source of truth for outgoing-request decoration | S | **done** (2026-05-21) | T-167a | TC-token-1 + 15 new tests | Configurable options: `authHeaderName`, `trustHeaderName`, `skipAuthHeader`, `includeTrustToken`, `includeAccessTokenTypeHeader`. Also `shouldSendCookies()` + `ready()`. 51 total tests pass. |
| T-167c | Add `AuthClient.attachToAxios()` / `attachToFetch()` helpers with auto-401-retry + unsubscribe handle | M | **done** (2026-05-21) | T-167b | TC-token-1,2,3,4,5 + 12 new tests | `skipPaths` supports string/regex/function. `onRefreshFailed` callback. `retryOn401` toggle. `__nestAuthRetried` per-request guard prevents loops. Axios shape via structural `AxiosLikeInstance` (no axios peer dep). 63 total tests pass. |
| T-167d | Add `AuthClient.getTokenState()` + `subscribeTokenState()` observable | XS | **done** (2026-05-21) | T-167a | + 8 new tests | Wraps `tokensSet`/`tokenRefreshed`/`tokensRemoved` events into clean state-store API. Exports `TokenState` interface. 71 total tests pass. |
| T-168 | Add refresh timeout (default 30s) wrapping `RefreshQueue` promise to prevent indefinite hang | XS | — | TC-424 | All callers reject within timeout |
| T-169 | Fix network error handling: return typed `AuthError` instead of `{status:0, ok:false, data:null}` | XS | — | TC-462 | Callers don't crash on `response.data.message` |
| T-170 | Fix `verifySession()` inconsistent state cleanup (call full `clearAuthState()`, not partial) | XS | — | TC-404 | Logout state always consistent |
| T-171 | Add `useIsBroadcastChannelActive()` hook for cross-tab sync transparency | XS | — | — | Consumers know which sync mechanism is running |
| T-172 | Reduce React guard duplication (component + HOC) by extracting shared predicate function | XS | — | TC-640-647 | — |
| T-173 | Verify + document Next.js SSR helpers across App Router AND Pages Router | S | T-022 | TC-660-664 | Tests cover both routing modes |
| T-174 | Export `AccessTokenType` and explicit transport-mode helpers | XS | — | — | Consumers can switch transport modes confidently |
| T-175 | Add `@microsoft/api-extractor` to detect breaking type changes across releases | S | T-010 | TC-701 | Accidental break-changes fail CI |
| T-176 | Add Zod schemas (or `valibot`) to all DTOs in contracts; client uses them for runtime validation | M | — | TC-700 | Runtime + compile-time type safety |
| T-177 | Document hook proliferation (7 hooks vs. next-auth's 1) — explain which to use when | XS | — | — | "Which hook?" decision tree in docs |
| T-178 | Add error-code matcher utility to client (`isAuthError(e, 'INVALID_CREDENTIALS')`) | XS | T-160 | — | Consumers don't string-match error messages |
| T-178a | React hook `useAuthHeaderFn()` + `useAuthHeaderFnSync()` returning stable function refs; replaces re-render-causing `useAccessToken()` for request-decoration use cases | S | **done** (2026-05-21) | T-167b | TC-token-7, TC-token-8 | `useCallback`-wrapped; ref only changes when client itself changes; supports same options as `getAuthHeaders` |
| T-178b | Deprecate `onTokensSet`/`onTokensRemoved` provider props with console.warn pointing to `attachToAxios`/`attachToFetch`; remove in v3.0 | XS | T-167c | — | Migration path documented; consumers warned |
| T-178c | Update `apps/example-react` + `apps/example-next` to use the new attach helpers — proves the design end-to-end | S | T-167c, T-178a | TC-token-9 | Consumer code is one line: `useEffect(() => client.attachToAxios(api), [client])` |

---

## Phase 8 — Security Hardening (12 tasks)

**Goal:** auth library must clear standard security bars. **1-2 weeks. Parallelizable with Phase 5-7.**

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-179 | Add rate limiting to login/OTP/signup endpoints (configurable, defaults sensible) | S | — | TC-903, TC-911 | 6th login attempt within window → 429 |
| T-180 | Add account lockout after N failed login attempts (configurable + admin unlock) | S | T-179 | TC-904 | — |
| T-181 | Add CSRF protection on state-changing endpoints when cookie-mode is active | S | — | TC-902 | Header-mode unaffected; cookie-mode protected |
| T-182 | Refresh token rotation: every refresh issues a new refresh; using an old refresh revokes the session | S | T-043 | TC-907, TC-142 | Stolen refresh tokens neutralized |
| T-183 | Session fixation prevention: regenerate session id on login | XS | T-041 | TC-908 | Pre-login ≠ post-login session id |
| T-184 | Verify timing-safe everywhere: password compare, OTP HMAC, token compare | XS | — | TC-109, TC-169, TC-909 | Statistical timing tests pass |
| T-185 | Account enumeration audit: signup-existing, forgot-unknown, login-unknown all return same shape | XS | — | TC-910 | No info leak via error differences |
| T-186 | Add `npm audit` to CI (fail on high/critical) | XS | T-010 | TC-916 | — |
| T-187 | Add Snyk or GitHub Dependabot security scanning | XS | — | TC-916 | — |
| T-188 | Nightly OWASP ZAP baseline scan against deployed `example-nest` | S | T-145 | TC-917 | Baseline scan green |
| T-189 | Write `SECURITY.md` with disclosure policy + contact | XS | — | — | Security researchers know how to report |
| T-190 | Pen-test prep: tracking issues for any pre-existing security smells found in audit | XS | — | — | Issues filed in `.tasks/` |

---

## Phase 9 — Release & Stabilization (17 tasks)

**Goal:** ship v2.0 GA with confidence and a stable maintenance posture. **1-2 weeks plus rollout time.**

### 9.A — Pre-release

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-191 | Cut v2.0.0-beta.1 from main; tag drives Changesets release | XS | All prior | — | Published to npm with `beta` dist-tag |
| T-192 | Internal dogfooding: use v2.0 beta on one internal project | S | T-191 | — | One bug-fix iteration |
| T-193 | Write compatibility matrix: nest-auth × Nest × Node × TS versions | XS | — | — | Doc page lives at `/docs/compatibility` |
| T-194 | Performance baseline with k6: 1000 concurrent signups, 10k logins, 100k sessions list | S | T-145 | TC-1100-1105 | Numbers published; regression budget set |

### 9.B — External rollout

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-195 | Migrate three production consumers from v1.x to v2.0 beta (with hand-holding) | L | T-094 | — | Three real customers, each signs off in writing |
| T-196 | Fix any blockers raised during T-195 | M | T-195 | — | All blocker issues closed |
| T-197 | Cut v2.0.0 GA | XS | T-196 | — | `latest` dist-tag updated |
| T-198 | Write launch post / changelog summary | XS | T-197 | — | — |
| T-199 | Update README, docs landing page to mark v2.0 GA | XS | T-197 | — | — |

### 9.C — Maintenance posture

| ID | Task | Effort | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|
| T-200 | Define SLO: critical bugs patched within 7 days; security disclosures within 24h | XS | — | — | Doc page lives at `/docs/support` |
| T-201 | Establish RFC process for breaking changes | XS | — | — | Template + label in repo |
| T-202 | Quarterly dependency-update sweep cadence | XS | — | — | Calendar reminder |
| T-203 | Plan v2.1: collect feature requests; schedule Phase 7 paired client packages (`$InferServerPlugin` typing) | XS | — | — | Backlog populated |
| T-204 | Plan v3 RFC: ISOLATED-mode Option B (per-tenant physical DB) | XS | T-108 | — | Issue filed with scope estimate |
| T-205 | Plan SAML/SSO plugin (deferred from v2) | — | — | — | v3 milestone item |
| T-206 | Plan React Native client (deferred from v2) | — | — | — | v3 milestone item |
| T-207 | Sunset plan for v1.x: security patches for 6 months post-v2 GA | XS | T-197 | — | Announced in changelog |

---

## Phase 10 — React Native + Social Login (17 tasks)

**Goal:** ergonomic social-login helpers (web + native) and a `@ackplus/nest-auth-react-native` SDK with native Google/Apple/Facebook auth. Full design: [`react-native-and-social-login.md`](react-native-and-social-login.md). The framework-agnostic client + async-aware TokenManager (T-167a) already make RN viable — this is adapters + native token providers + docs.

| ID | Task | Effort | Status | Depends | Verifies | Acceptance |
|---|---|---|---|---|---|---|
| RN-1 | `AuthClient.socialLogin(provider, token, opts)` helper + export | XS | **done** (2026-05-21) | T-167 | TC-RN-1,2 | Wraps `login` with `createUserIfNotExists` default; MFA-aware |
| RN-2 | `SocialAuthProvider` interface (token-acquisition abstraction) | XS | open | — | TC-RN-8 | Web + native adapters implement it |
| RN-3 | Real test: `socialLogin` against GitHub stub | S | **done** (2026-05-21) | RN-1 | TC-RN-1..4 | Posts correct DTO; returns tokens; extends proven oauth-github pattern |
| RN-4 | `useSocialLogin()` web hook (Google Identity Services + Apple JS, lazy-loaded) | M | open | RN-1 | — | Web popup sign-in → auth state |
| RN-5 | Scaffold `@ackplus/nest-auth-react-native` package | S | open | T-002 | — | turbo + tsup + RN tsconfig |
| RN-6 | `AsyncStorageAdapter` + `SecureStorageAdapter` + tests | S | open | RN-5 | TC-RN-5..7 | Real adapters; keychain/securestore optional |
| RN-7 | `NestAuthNativeProvider` (RN defaults: header mode, async storage, `ready()` gate) | S | open | RN-6 | — | Reuses nest-auth-react hooks |
| RN-8 | Backend: injectable Google token verifier + `google.*Url` overrides (stubbable) | M | open | T-8 (github URLs) | TC-RN-11 | Google login testable without hitting Google |
| RN-9 | Google native adapter (`@react-native-google-signin`) | S | open | RN-2 | TC-RN-9 | Returns `{ token, type: 'idToken' }` |
| RN-10 | Apple native adapter (`@invertase/react-native-apple-authentication`) | S | open | RN-2 | TC-RN-10 | Forwards first-sign-in name/email |
| RN-11 | Facebook native adapter (`react-native-fbsdk-next`) | S | open | RN-2 | — | Returns access token |
| RN-12 | Backend: Apple provider accepts + persists first-sign-in name/email | S | open | — | TC-RN-12 | Name captured (Apple only sends it once) |
| RN-13 | Generic `react-native-app-auth` adapter (any OIDC, PKCE) | M | open | RN-2 | — | Microsoft/Okta/Auth0/custom |
| RN-14 | `use-native-social-login` hook | S | open | RN-7,RN-9 | — | One-call native sign-in |
| RN-15 | `apps/example-react-native` (Expo): email + Google + Apple | M | open | RN-7,RN-14 | TC-RN-E2E-* | Live demo |
| RN-16 | Docs: RN quickstart, native setup, Apple App Store rule, secure storage | M | open | RN-15 | — | Copy-paste setup |
| RN-17 | Detox E2E harness (device CI, optional) | L | open | RN-15 | TC-RN-E2E-1..4 | On-device sign-in verified |

---

## Phase 11 — Compliance & Standards (universal) (16 tasks)

**Goal:** make the package a defensible **technical-controls foundation for ANY regulated use case**, not just healthcare. The controls are framework-agnostic — the *same* set (MFA, strong hashing, rate-limit, lockout, audit, session management, least-privilege) satisfies the auth slice of **OWASP ASVS L2, NIST 800-63B AAL2, SOC 2, ISO 27001, PCI-DSS, GDPR, India DPDP, CCPA, HIPAA, PSD2-SCA**. We anchor on **ASVS L2 + NIST 800-63B AAL2** (the two standards that directly specify these controls) and map everything else to them.

- **Public compliance posture doc:** `apps/docs/content/docs/production/compliance.mdx` (consumer-facing; states shipped vs configurable vs roadmap per control + the cross-framework mapping + shared-responsibility model).
- **Internal assessment + healthcare depth:** [`compliance-and-healthcare.md`](compliance-and-healthcare.md).
- **P0 gaps (block any high-assurance use):** CMP-1..CMP-5 — rate-limit, lockout, complete+persistent+tamper-evident audit, break-glass.
- Several controls land as plugins (audit-store, emergency-access, consent, abdm) per the plugin architecture.

| ID | Task | Effort | Status | Verifies |
|---|---|---|---|---|
| CMP-1 | Rate-limiting (per-IP + per-account) on login/OTP/reset/MFA → 429 | M | open (P0) | TC-CMP-1,3 |
| CMP-2 | Account lockout: failed-attempt counter, progressive lock, admin unlock, audit | M | open (P0) | TC-CMP-2 |
| CMP-3 | Expand audit events (FAILED_LOGIN, admin actions, impersonation, session-revoke, perm/role change, api-key, account-locked, break-glass) | S | **in-progress** — `LOGIN_FAILED` done (HIPAA §164.312(b) failed-access logging: event + emit in login catch + AuditService listener + 4 real tests; reasonCode always present via status fallback; password never leaked). Remaining: admin/impersonation/session-revoke/perm-change/api-key/account-locked events. | TC-CMP-4 ✅ |
| CMP-4 | `audit-store` plugin: append-only, hash-chained (tamper-evident) persistent log + retention config (HIPAA 6yr) | M | open (P0) | TC-CMP-6 |
| CMP-5 | `emergency-access` (break-glass) plugin: time-boxed elevated grant + reason + alert + auto-expire | M | open (P0) | TC-CMP-7 |
| CMP-6 | Breached-password check (HaveIBeenPwned k-anonymity), opt-in | S | open (P1) | TC-CMP-8 |
| CMP-7 | `@RequireRecentAuth(maxAge)` step-up guard + `recentAuthAt` in session | S | open (P1) | TC-CMP-9 |
| CMP-8 | Concurrent-session limit per user (evict-oldest / block-new) | S | open (P1) | TC-CMP-10 |
| CMP-9 | `consent` plugin: versioned consent capture + grant/withdraw events | M | open (P1) | TC-CMP-11 |
| CMP-10 | `exportUserData(userId)` + `eraseUser(userId, {mode})` with audit (DPDP/GDPR) | M | open (P1) | TC-CMP-12 |
| CMP-11 | Explicit `cookie.secure`/`sameSite` config + healthcare-preset defaults + startup warning | XS | open (P2) | TC-CMP-16 |
| CMP-12 | Password-policy presets (`nist-800-63b`, `healthcare`) | XS | open (P2) | — |
| CMP-13 | `compliance: 'hipaa'\|'nist-800-63b'\|'gdpr'\|'baseline'` preset that flips safe defaults | M | open (P2) | TC-CMP-14 |
| CMP-14 | `complianceReport()` boot-time control inventory + CI assertion helper | S | open (P2) | TC-CMP-15 |
| CMP-15 | Docs: HIPAA shared-responsibility matrix, BAA note, retention + deployment checklist, HMS recipe | M | open (P2) | — |
| CMP-16 | `abdm`/`abha` plugin (India national health stack) — optional | L | open (P3) | — |

---

## Indexes

### By priority (P0 = blocks v2.0 ship)

**P0 (everything in Phase 0-4 is P0 except where noted)** — T-001 to T-108

**P1** — Phase 5-7: T-109 to T-178

**P2** — Phase 8-9: T-179 to T-207

### By package

| Package | Tasks |
|---|---|
| Monorepo / tooling | T-001 to T-010, T-186, T-187 |
| `nest-auth` (backend) | T-026 to T-108 |
| `nest-auth-client` | T-167 to T-178 |
| `nest-auth-react` | T-022, T-171 to T-173 |
| `nest-auth-contracts` | T-160, T-176 |
| `nest-auth-admin` (new) | T-109 to T-133 |
| Docs | T-146 to T-166 |
| Examples | T-134 to T-145 |
| Security | T-179 to T-190 |
| Release | T-191 to T-207 |

### Critical-path dependency graph (simplified)

```
Phase 0 (T-001..T-010)
   ↓
Phase 1 (T-011..T-025) ──┐
   ↓                     │
Phase 2 (T-026..T-059)   │
   ↓                     │
Phase 3 (T-060..T-094)   │
   ↓                     │
   ├─→ Phase 4 (T-095..T-108)
   ├─→ Phase 5 (T-109..T-133) ←── Phase 6 (T-134..T-166, partly parallel)
   ├─→ Phase 7 (T-167..T-178, parallel)
   └─→ Phase 8 (T-179..T-190, parallel)
                                          ↓
                                  Phase 9 (T-191..T-207)
```

### Effort summary

| Phase | Tasks | Wall-clock |
|---|---|---|
| 0 — Monorepo Foundation | 10 | 3-5 days |
| 1 — Test Infrastructure | 15 | 1-2 weeks |
| 2 — Architecture Refactor | 32 | 3-4 weeks |
| 3 — Plugin System | 35 | 2-3 weeks |
| 4 — Multi-tenancy | 14 | 2-4 weeks |
| 5 — Admin UI Redesign | 25 | 3-4 weeks |
| 6 — Examples + Docs | 33 | 2-3 weeks (parallel) |
| 7 — Client SDK Quality | 12 | 1-2 weeks (parallel) |
| 8 — Security Hardening | 12 | 1-2 weeks (parallel) |
| 9 — Release & Stabilization | 17 | 1-2 weeks + rollout |
| **Total** | **207** | **~13-18 weeks wall-clock** |

With parallelism after Phase 4: realistic single-engineer timeline **~16 weeks (4 months)**. Two engineers: **~10-12 weeks**.

---

## Tracking discipline

- **Update this file as work progresses.** Flip `status: open` → `in-progress` → `done` in the table cells (when a task gets a status, add a column). Keep the table compact.
- **One task per PR.** PR title format: `T-NNN: <task title>`. Closing the PR flips the task status.
- **Non-trivial tasks (M/L/XL) get a dedicated `.tasks/NNN-*.md` file** when work starts; this tracker links to it.
- **No work outside this tracker.** If something new comes up: add a new T-NNN row, link it from the right phase. Bug → file under existing `.tasks/NNN-*.md` numbering, link from here.

---

## Quick-start cheat sheet

If you (engineer or AI agent) are picking this up cold:

1. Read [`000-master-roadmap.md`](000-master-roadmap.md) (why).
2. Read this file (what).
3. Read [`test-catalog.md`](test-catalog.md) (verification).
4. Read [`monorepo-and-deployment.md`](monorepo-and-deployment.md) (Phase 0 detail).
5. Pick the lowest-numbered `open` task whose deps are all `done`.
6. Branch: `git checkout -b T-NNN-short-slug`.
7. Implement + tests (real tests, no mocks).
8. PR: `T-NNN: <title>`. CI must be green. Link the TC-NNN tests added.
9. Merge → flip status to `done` here.

If you (an AI agent) need to add a new auth method: see `packages/nest-auth/src/plugins/built-in/email-password/` for the template and `AGENTS.md` in that folder.

If you (an AI agent) need to debug: hit `GET /auth/_meta` for the live plugin tree + override map.

---

## Verification — what "100% bug-free, reliable, customizable" means concretely

Tied directly to the Definition of Done at the top of this file. Every claim is measurable:

| Claim | Measurement |
|---|---|
| 100% bug-free | Every `.tasks/NNN-*.md` `status: fixed`; every `TC-NNN` passes; nightly ZAP scan clean; `npm audit` clean |
| Reliable | k6 baseline met (T-194); 99.9% uptime SLO on Railway demo over rolling 30d |
| Customizable | Three real customers ship custom plugins (T-195); plugin docs (T-154) prove a new plugin in 1 hour |
| SDK proper | Client SDK split (T-167); refresh timeout (T-168); breaking-change detection (T-175); typed errors (T-178) |
| Documentation 100% correct | OpenAPI generated from live code (T-024); docs E2E-tested (T-144); link-checker green (T-163); AGENTS + llms.txt complete (T-156-T-159) |

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) — strategic plan
- [`test-catalog.md`](test-catalog.md) — verification matrix
- [`monorepo-and-deployment.md`](monorepo-and-deployment.md) — Phase 0 + deployment
- [`audit-types.md`](audit-types.md) — type/enum duplication audit (closed by T-166)
