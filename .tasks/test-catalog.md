---
id: test-catalog
priority: P0
area: all
status: open
package: monorepo
title: Complete test catalog — ~545 test cases across all four packages (real-test-only policy)
---

## Summary

Authoritative catalog of every test case required for the package to be considered production-stable. Every test has a stable `TC-NNN` ID that PRs, `.tasks/` files, and CI reports reference.

**Coverage targets:**
- `nest-auth-contracts` — type-check only (`tsc --noEmit`), 100%
- `nest-auth` (backend) — ≥85% line / 80% branch
- `nest-auth-client` — ≥90%
- `nest-auth-react` — ≥80% component, full happy-path E2E
- `nest-auth-admin` (UI) — ≥70% component, full E2E happy-path

**Estimated effort:** ~545 cases total. Phase 1 (P0 only) ≈ 180 cases ≈ 2 weeks for one engineer.

> **2026-06-02 coverage audit:** an endpoint-vs-catalog gap audit added 27 verified-absent cases — TC-054..056, 078, 110..115, 143..144, 172, 186..187, 323..326, 366, 918..924. These fill MFA-management endpoints (`status`/`toggle`/`devices`/`reset-totp`), the auth-controller read endpoints (`/auth/me`, `/auth/user`, `/auth/verify-session`, `/auth/client-config`), phone+password login, OAuth-only forgot-password, admin session sub-resources, backend refresh-race dedup, password history, email-change re-verification, and seven security vectors (claim validation, race double-use, length/DoS boundaries, homoglyph, null-byte, OAuth-state CSRF).

---

## No-mock policy

**Rule:** No mocking of internal classes, services, or repositories. Tests exercise the real implementations exactly as production does.

### What this means

| Category | Approach |
|---|---|
| Database | **Real Postgres** via Testcontainers (per-suite container, truncated between tests). MySQL/SQLite covered in CI matrix. |
| Cache / sessions | **Real Redis** via Testcontainers when testing the Redis backend. |
| HTTP server | **Real NestJS app** booted via `@nestjs/testing` `Test.createTestingModule(...).compile()` + `app.init()`. Drive with `supertest` against the real Express adapter. |
| Client → backend | Client tests boot a real backend in-process and configure `AuthClient` to hit that URL. No `msw`, no `nock` for *our* HTTP. |
| React tests | Render with a real `AuthClient` hitting a real backend booted in `beforeAll`. No mocked client. |
| Crypto, JWT, hashing | Real `bcrypt`, real `jsonwebtoken`, real `crypto`. |
| Event bus | Real `EventEmitter2`. |
| TypeORM repositories | Real repositories, real entities, real migrations applied. |

### What is allowed (because the external boundary is not ours)

These are **test doubles that are real implementations of a port** — not `jest.fn()` mocks of our classes.

| External boundary | Test double |
|---|---|
| OAuth provider HTTP (Google/GitHub/Facebook/Apple/custom) | Local stub server (Express on a random port) we boot in `beforeAll`; it implements the provider's documented response shape. Client of our auth package hits it as if it were Google. |
| Email transport | A real `EmailTransport` implementation that writes to an in-memory `MessageStore` we can assert against. Same interface as the production SMTP/Resend transport. |
| SMS transport | Same pattern — real `SmsTransport` → in-memory store. |
| Wall-clock time | Real time, except for narrow expiry tests where we use `@sinonjs/fake-timers` to advance the clock. We never mock `Date` ad-hoc. |
| `process.env` | Real env, set in `beforeAll`, restored in `afterAll`. |

**Banned in this codebase:** `vi.mock()`, `jest.mock()`, `vi.spyOn(someService, 'method').mockResolvedValue(...)` on our own classes, `MockRepository`, `MockUserService`, etc.

### Rationale

The mockist approach hides design problems (god-services pass because their N collaborators are mocked); the classicist approach tells you when your design is wrong because the test setup gets painful. It also produces tests that survive refactors — most of our planned refactors (splitting `AuthService`, plugin extraction) would invalidate every mock-heavy test.

### Testcontainers boot cost

Per-suite Postgres container starts in ~2s; we share one container across an entire suite file. Total test-run time target: <2 min for unit+integration, <5 min including E2E. If we breach this, we parallelize at the file level (Vitest's default) — not by adding mocks.

---

## Recommended stack

| Layer | Tool | Notes |
|---|---|---|
| Test runner | **Vitest** | Faster than Jest, ESM-native, matches the Vite UI |
| HTTP driver | **supertest** | Against real `app.getHttpAdapter().getInstance()` |
| Container management | **`@testcontainers/postgresql`**, **`@testcontainers/redis`** | One container per test file (shared via `beforeAll`) |
| Time control | **`@sinonjs/fake-timers`** | Narrow use only — installed/uninstalled per test |
| Browser E2E | **Playwright** | Cross-browser, screenshots, video on failure |
| Load | **k6** | Scripted load tests, run weekly in CI |
| Security DAST | **OWASP ZAP** baseline | Nightly against `example-nest` |
| OpenAPI lint | **`@stoplight/spectral-cli`** | Fails CI on spec smells |
| Mutation testing (optional, later) | **Stryker** | Validate that our tests actually catch bugs |

---

## A. Backend — `@ackplus/nest-auth`

### A.1 Signup flows (P0)

| ID | Test | Type |
|---|---|---|
| TC-001 | Email+password signup creates user, identity, session | integration |
| TC-002 | Signup with duplicate email returns 409 with `EMAIL_ALREADY_EXISTS` | integration |
| TC-003 | Signup with invalid email format returns 400 | unit (DTO) |
| TC-004 | Signup with weak password returns 400 with policy reason | unit (DTO) |
| TC-005 | Signup normalizes email to lowercase + trimmed | unit |
| TC-006 | Signup with phone+password creates user with normalized phone | integration |
| TC-007 | Phone signup with invalid format returns 400 | unit |
| TC-008 | Signup emits `REGISTERED` event with correct payload | integration |
| TC-009 | `beforeSignup` hook can mutate payload | integration |
| TC-010 | `beforeSignup` throwing aborts signup, no user created (transaction rollback verified via real DB query) | integration |
| TC-011 | `onSignup` hook fires after user created | integration |
| TC-012 | `onSignup` throwing does NOT roll back user (documented post-commit behavior) | integration |
| TC-013 | Signup with `emailVerifiedAt` unset triggers `EMAIL_VERIFICATION_REQUESTED` | integration |
| TC-014 | Concurrent signups with same email → exactly one user created (real race via `Promise.all` of N parallel inserts) | integration |
| TC-015 | Signup respects `sensitiveFields` config (excluded from response) | integration |
| TC-016 | Custom user fields persisted via `metadata` JSON column (round-trip through real DB) | integration |
| TC-017 | Signup with `tenantId` in DISABLED mode → 400 | integration |
| TC-018 | Signup in SHARED mode without tenantId → user created globally | integration |
| TC-019 | Signup in SHARED mode with valid tenantId → user + userAccess for that tenant | integration |
| TC-020 | Signup in ISOLATED mode requires tenantId | integration |
| TC-021 | Signup in ISOLATED mode: same email allowed for different tenants | integration |
| TC-022 | Signup in ISOLATED mode: duplicate email in same tenant → 409 | integration |

### A.2 Login flows (P0)

| ID | Test | Type |
|---|---|---|
| TC-030 | Email+password login returns access+refresh tokens | integration |
| TC-031 | Wrong password returns 401 with `INVALID_CREDENTIALS` | integration |
| TC-032 | Login with non-existent email returns 401 (same error code — no enumeration) | integration |
| TC-033 | Login normalizes email before lookup | integration |
| TC-034 | Login response shape matches contract `IAuthResponse` | integration |
| TC-035 | Login fires `LOGGED_IN` event | integration |
| TC-036 | Login creates session row with `userId`, `tenantId`, `userAgent`, `ipAddress` (verified by real SELECT) | integration |
| TC-037 | `beforeLogin` hook can reject (returns 403) | integration |
| TC-038 | `onLogin` hook fires after session created | integration |
| TC-039 | Phone+OTP login: send OTP → verify OTP → tokens returned (OTP fetched from real DB) | integration |
| TC-040 | OTP expired → 401 (advance clock with sinon fake timers) | integration |
| TC-041 | OTP used twice → second use rejected | integration |
| TC-042 | Magic link: send → click link → tokens returned (token fetched from real email store) | integration |
| TC-043 | Magic link reused → second use rejected | integration |
| TC-044 | Magic link expired → 401 | integration |
| TC-045 | Passwordless email OTP: send → verify → tokens | integration |
| TC-046 | Passwordless SMS OTP: send → verify → tokens | integration |
| TC-047 | Passwordless with `allowSignUp=true` creates user on first send | integration |
| TC-048 | Passwordless with `allowSignUp=false` and unknown email → 404 | integration |
| TC-049 | Inactive user (`isActive=false`) can't log in | integration |
| TC-050 | Login in DISABLED mode with tenantId in body → 400 | integration |
| TC-051 | Login in SHARED mode resolves user globally | integration |
| TC-052 | Login in ISOLATED mode requires tenantId, scopes lookup | integration |
| TC-053 | Plaintext password NEVER appears in logs (grep captured logs from real logger) — regression for [`.tasks/002`](002-plaintext-password-logged.md) | integration |
| TC-054 | **Phone + password** login (identifier=phone, credential=password) → tokens — distinct from TC-039 (phone+OTP) | integration |
| TC-055 | `GET /auth/me` returns the current authenticated user; 401 without/with-invalid token | integration |
| TC-056 | `GET /auth/user` returns the full user object (not the session-shaped `/me`); respects tenant scoping in ISOLATED mode | integration |

### A.3 OAuth flows (P1)

OAuth tests use a **local stub HTTP server** that implements each provider's documented response shape. The stub is a real Express app booted on a random port in `beforeAll`. Our auth code thinks it's hitting Google.

| ID | Test | Type |
|---|---|---|
| TC-060 | Google OAuth: valid access token → user + identity created | integration (real stub server) |
| TC-061 | Google OAuth: existing user with same email → identity linked | integration |
| TC-062 | Google OAuth: `email_verified=false` rejected when `requireVerifiedEmail=true` — [`.tasks/011`](011-google-email-verified-check-disabled.md) | integration |
| TC-063 | Google OAuth: `email_verified=false` allowed when `requireVerifiedEmail=false` | integration |
| TC-064 | Google OAuth: lifts `emailVerifiedAt` when provider says verified | integration |
| TC-065 | GitHub OAuth: extracts primary verified email | integration |
| TC-066 | GitHub OAuth: no public email → 422 with actionable error — [`.tasks/012`](012-github-provider-error-swallowing.md) | integration |
| TC-067 | GitHub OAuth: stub server returns 500 → our code returns 502, not 401 | integration |
| TC-068 | Facebook OAuth happy path | integration |
| TC-069 | Apple OAuth happy path | integration |
| TC-070 | Custom OAuth provider registered via plugin → callback works | integration |
| TC-071 | OAuth providers skip MFA consistently — [`.tasks/010`](010-social-providers-skipmfa-inconsistent.md) | integration |
| TC-072 | OAuth response uses USER id, not provider id — regression for [`.tasks/003`](003-email-provider-returns-email-as-userid.md) | integration |
| TC-073 | Concurrent OAuth callbacks for same (provider, providerId) → exactly one identity (real race) | integration |
| TC-074 | OAuth in ISOLATED mode: same Google user can register per tenant | integration |
| TC-075 | Link additional provider to existing user | integration |
| TC-076 | Unlink provider, keep at least one auth method | integration |
| TC-077 | Unlink last provider when no password set → 422 | integration |
| TC-078 | OAuth-only user (no password identity) requests forgot-password → generic 200, NO password credential silently created, no account-enumeration leak | integration |

### A.4 MFA (P0)

| ID | Test | Type |
|---|---|---|
| TC-090 | TOTP setup returns secret + QR code | integration |
| TC-091 | TOTP verify with correct code → MFA enabled (code generated with real `otplib`) | integration |
| TC-092 | TOTP verify with wrong code → 401 | integration |
| TC-093 | TOTP verify with clock-skew tolerance window | integration |
| TC-094 | Login with MFA enabled → returns 200 + `mfaRequired=true`, no tokens yet | integration |
| TC-095 | MFA challenge with valid TOTP → tokens returned | integration |
| TC-096 | MFA challenge with wrong TOTP → 401 | integration |
| TC-097 | Email OTP MFA: send → verify → tokens | integration |
| TC-098 | SMS OTP MFA: send → verify → tokens | integration |
| TC-099 | Recovery code: generate → use → marked used → cannot reuse | integration |
| TC-100 | Recovery codes regenerate invalidates old set | integration |
| TC-101 | Trusted device: register on MFA verify → next login skips MFA | integration |
| TC-102 | Trusted device expires → MFA required again (fake-timer advance) | integration |
| TC-103 | Revoke trusted device → MFA required next login | integration |
| TC-104 | Disable MFA requires password re-auth | integration |
| TC-105 | MFA in SHARED mode: TOTP works across all tenants — [`.tasks/024`](024-mfa-not-tenant-scoped-design-undocumented.md) | integration |
| TC-106 | MFA in ISOLATED mode (post-fix): TOTP per tenant | integration |
| TC-107 | MFA brute force: 5 wrong codes → 429 lockout | integration |
| TC-108 | `@SkipMfa()` decorator skips MFA enforcement | integration |
| TC-109 | OTP HMAC validation is timing-safe (statistical test across N runs) | unit |
| TC-110 | `GET /auth/mfa/status` returns `{enabled, methods, devices, canToggle}` for the authed user; 401 unauth | integration |
| TC-111 | `POST /auth/mfa/toggle {enabled:true}` enables MFA; `{enabled:false}` disables it (state verified via real DB) | integration |
| TC-112 | `GET /auth/mfa/devices` lists registered TOTP authenticator devices (metadata only, never the secret) — distinct from trusted devices (TC-101..103) | integration |
| TC-113 | `DELETE /auth/mfa/devices/:deviceId` removes one TOTP device; siblings untouched; removing the last device disables MFA or 422 per config | integration |
| TC-114 | `POST /auth/mfa/reset-totp` with a valid recovery code clears the TOTP secret and marks the code used | integration |
| TC-115 | `POST /auth/mfa/toggle {enabled:false}` under a REQUIRED-MFA policy → 403 (cannot opt out) | integration |

### A.5 Session management (P0)

| ID | Test | Type |
|---|---|---|
| TC-120 | Refresh token returns new access+refresh pair | integration |
| TC-121 | Refresh with expired refresh token → 401 | integration |
| TC-122 | Refresh with revoked session → 401 | integration |
| TC-123 | Refresh with tampered token → 401 | integration |
| TC-124 | Refresh after `switchTenant` preserves tenantId — [`.tasks/020`](020-refresh-after-switchtenant-fragility.md) | integration |
| TC-125 | Refresh queue: 10 concurrent calls → 1 backend hit, all get same token | integration |
| TC-126 | Refresh fails → all queued callers reject with same error | integration |
| TC-127 | Logout revokes current session (verified via real SELECT on sessions table) | integration |
| TC-128 | Logout-all revokes all sessions for user | integration |
| TC-129 | Session touched on activity at configurable interval — regression for [`.tasks/009`](009-session-touch-interval-hardcoded.md) | integration |
| TC-130 | Session expiry enforced on guard check | integration |
| TC-131 | Session revoke fires `onRevoked` hook with actual reason — regression for [`.tasks/008`](008-session-onrevoked-hardcoded-reason.md) | integration |
| TC-132 | DB session store: CRUD against real Postgres | integration |
| TC-133 | Redis session store: CRUD against real Redis (Testcontainers) | integration |
| TC-134 | In-memory session store: CRUD | unit |
| TC-135 | Swap session backend via config and re-run the same scenario | integration |
| TC-136 | Cookie transport: tokens set as httpOnly cookies (verified on real `Set-Cookie` header) | integration |
| TC-137 | Header transport: tokens in response body | integration |
| TC-138 | Cookie `Secure`/`SameSite`/`Domain`/`Path` configurable | integration |
| TC-139 | `sessions.tenantId` queryable as a column (post-fix) — [`.tasks/022`](022-sessions-tenantid-not-a-column.md) | integration |
| TC-140 | `findByUser(userId, tenantId)` returns only sessions for that tenant | integration |
| TC-141 | Revoking one session does not affect siblings | integration |
| TC-142 | Refresh token rotation: old refresh token invalidated on use | integration |
| TC-143 | **Backend** concurrent refresh with the same token (real `Promise.all` race) → exactly one new pair issued, the losers get 401 + reuse flagged — server-side dedup, distinct from the client queue (TC-125) | integration |
| TC-144 | `GET /auth/verify-session` returns `{valid, userId, expiresAt}`; invalid/expired token → `valid:false`/401; returns a fresh `expiresAt` immediately after a rotation | integration |

### A.6 Password management (P0)

| ID | Test | Type |
|---|---|---|
| TC-160 | Forgot password sends reset token via real email transport → message captured in store | integration |
| TC-161 | Reset password with valid token → password updated, token invalidated | integration |
| TC-162 | Reset password with expired token → 401 | integration |
| TC-163 | Reset password with used token → 401 | integration |
| TC-164 | Reset password invalidates all existing sessions for that user | integration |
| TC-165 | Change password (authenticated) requires old password | integration |
| TC-166 | Change password with wrong old password → 401 | integration |
| TC-167 | Change password fires `PASSWORD_CHANGED` event | integration |
| TC-168 | Password hashing: real bcrypt with configurable rounds (default 10) | unit |
| TC-169 | bcrypt compare is timing-safe (statistical across 1000 runs) | unit |
| TC-170 | Password policy: min length, complexity, banned-list enforced | unit |
| TC-171 | Forgot password for unknown email returns 200 (no enumeration) and does NOT send email | integration |
| TC-172 | Password history: change/reset rejects reuse of the last N passwords when `passwordHistory` is configured (real hash comparison against stored history) | integration |

### A.7 Verification flows (P1)

| ID | Test | Type |
|---|---|---|
| TC-180 | Send email verification token, captured in store | integration |
| TC-181 | Verify email with token → `emailVerifiedAt` set | integration |
| TC-182 | Resend verification token (rate-limited) | integration |
| TC-183 | Send phone OTP for verification | integration |
| TC-184 | Verify phone with OTP → `phoneVerifiedAt` set | integration |
| TC-185 | Verification token expires | integration |
| TC-186 | Change email → new address requires re-verification; the identity email is NOT switched until verified; the old email keeps working meanwhile | integration |
| TC-187 | Email / phone verification token is single-use (reuse after success → 401) — TC-185 only covers expiry | integration |

### A.8 RBAC + Guards (P0)

| ID | Test | Type |
|---|---|---|
| TC-200 | `AuthGuard` allows valid JWT (real `jsonwebtoken` sign+verify) | integration |
| TC-201 | `AuthGuard` rejects invalid/expired/missing JWT | integration |
| TC-202 | `AuthGuard` returns `MFA_REQUIRED` when MFA pending | integration |
| TC-203 | `@Roles('admin')` allows user with role | integration |
| TC-204 | `@Roles('admin')` rejects user without role | integration |
| TC-205 | `@Permissions('users.read')` enforces permission | integration |
| TC-206 | Multi-guard: `web` user can't access `@RequireGuard('api')` endpoint | integration |
| TC-207 | Platform-level role (tenantId=null) works in DISABLED mode | integration |
| TC-208 | Tenant-scoped role only valid in matching tenant | integration |
| TC-209 | `resolveRoles` hook overrides default lookup | integration |
| TC-210 | `resolvePermissions` hook overrides default lookup | integration |
| TC-211 | `beforeAuth` hook can reject request | integration |
| TC-212 | `afterAuth` hook can mutate request context | integration |
| TC-213 | Public route (no `@UseGuards`) skips auth | integration |
| TC-214 | Role assignment is transactional (user_access + roles join) — verified by failing mid-transaction and checking nothing partially committed | integration |
| TC-215 | Role with cross-tenant permissions correctly scoped | integration |

### A.9 Multi-tenancy — DISABLED mode (P0)

| ID | Test | Type |
|---|---|---|
| TC-230 | All endpoints reject `tenantId` in body/query/header | integration |
| TC-231 | `switchTenant` returns 400 — [`.tasks/017`](017-switchtenant-no-mode-guard.md) | integration |
| TC-232 | `@CurrentTenantId()` returns `null` | unit |
| TC-233 | Sessions don't store tenantId | integration |
| TC-234 | Roles created without tenantId | integration |

### A.10 Multi-tenancy — SHARED mode (P0)

| ID | Test | Type |
|---|---|---|
| TC-250 | User created without tenantId is global | integration |
| TC-251 | User joins tenant via `userAccess` create | integration |
| TC-252 | Same email cannot register twice (global unique) | integration |
| TC-253 | `switchTenant` updates session.tenantId | integration |
| TC-254 | `switchTenant` to non-member tenant → 403 | integration |
| TC-255 | User has different roles per tenant | integration |
| TC-256 | Permission check uses tenantId from session | integration |
| TC-257 | Delete user with multiple userAccess → all cascaded | integration |
| TC-258 | Disable user globally vs. disable in one tenant | integration |
| TC-259 | Refresh in tenant A returns tenant A claims | integration |

### A.11 Multi-tenancy — ISOLATED mode (P0, blocked on fix)

| ID | Test | Type |
|---|---|---|
| TC-270 | Same email registers per-tenant successfully — [`.tasks/019`](019-isolated-mode-not-actually-isolated.md) | integration |
| TC-271 | Same email in same tenant rejected | integration |
| TC-272 | `switchTenant` returns 400 (mode guard) | integration |
| TC-273 | Login resolves by `(email, tenantId)` | integration |
| TC-274 | OAuth identity scoped per tenant | integration |
| TC-275 | MFA secret per tenant (post-fix) | integration |
| TC-276 | Trusted device per tenant (post-fix) | integration |
| TC-277 | Cross-tenant token forgery rejected (sign a token claiming tenant B with tenant A user → 403) | integration |

### A.12 API Keys (P1)

| ID | Test | Type |
|---|---|---|
| TC-290 | Create API key returns one-time-visible secret | integration |
| TC-291 | List API keys never returns secret | integration |
| TC-292 | API key auth on request via header | integration |
| TC-293 | Revoked API key → 401 | integration |
| TC-294 | Expired API key → 401 | integration |
| TC-295 | API key permissions scoped per key | integration |
| TC-296 | API key tenant-scoped | integration |

### A.13 Admin console (P0)

| ID | Test | Type |
|---|---|---|
| TC-310 | Admin signup with valid secretKey | integration |
| TC-311 | Admin signup with wrong secretKey → 403 | integration |
| TC-312 | Admin login validates password (no bypass) — regression [`.tasks/001`](001-admin-password-validation-bypassed.md) | integration |
| TC-313 | Admin session cookie set on login | integration |
| TC-314 | Admin session expires per config | integration |
| TC-315 | Admin CRUD users — list/get/create/update/delete | integration |
| TC-316 | Admin assign roles to user | integration |
| TC-317 | Admin revoke individual session (new feature) | integration |
| TC-318 | Admin reset MFA for user (new feature) | integration |
| TC-319 | Admin impersonate user → impersonation token issued, audit logged (new feature) | integration |
| TC-320 | Admin CRUD roles + permissions + tenants | integration |
| TC-321 | Non-admin user cannot hit `/auth/admin/*` API | integration |
| TC-322 | Admin endpoints all have `@ApiResponse` — regression [`.tasks/007`](007-admin-controllers-missing-api-response-decorators.md) | unit (AST scan) |
| TC-323 | `GET /admin/users/:id/sessions` lists a user's active sessions (verified against the real sessions table) | integration |
| TC-324 | `DELETE /admin/users/:id/sessions` revokes ALL of a user's sessions — distinct from TC-317's single-session revoke | integration |
| TC-325 | `POST /admin/users` (admin-created user with a preset password) → that user can subsequently log in | integration |
| TC-326 | `DELETE /admin/users/:id/totp-devices/:deviceId` (admin) removes a user's TOTP device; MFA state updates accordingly | integration |

### A.14 Hooks + Events (P1)

| ID | Test | Type |
|---|---|---|
| TC-340 | All documented hook names trigger at right lifecycle point | integration |
| TC-341 | All documented events fire with strict-typed payload | integration |
| TC-342 | Hook throwing aborts flow (sync semantics) | integration |
| TC-343 | Event listener throwing does NOT abort flow | integration |
| TC-344 | Multiple listeners for same event all run | integration |
| TC-345 | `EventEmitterModule.forRoot()` missing → init throws helpful error | integration |
| TC-346 | `transformResponse` hook can reshape login response | integration |
| TC-347 | `getSessionUserData` hook merges custom fields into JWT | integration |
| TC-348 | `sensitiveFields` config strips fields from response | integration |

### A.15 Configuration & module wiring (P1)

| ID | Test | Type |
|---|---|---|
| TC-360 | `NestAuthModule.forRoot()` with minimal config boots | integration |
| TC-361 | `NestAuthModule.forRootAsync()` injects async config | integration |
| TC-362 | Missing JWT secret throws at init time | integration |
| TC-363 | Invalid tenant mode throws at init time | integration |
| TC-364 | Defaults applied for unspecified fields | unit |
| TC-365 | OpenAPI spec exposed at `/api/json` | integration |
| TC-366 | `GET /auth/client-config` (public, no auth) returns tenant mode, enabled providers, MFA methods, and registration flags — and leaks NO secrets (JWT secret, OAuth client secrets, admin secretKey) | integration |

### A.16 Plugin system (P0 — new)

| ID | Test | Type |
|---|---|---|
| TC-380 | Plugin registered via `plugins: [...]` adds its entities to TypeORM | integration |
| TC-381 | Plugin's controllers reachable on configured route prefix | integration |
| TC-382 | Plugin's event subscribers fire on core events | integration |
| TC-383 | Plugin's lifecycle hook `onAppBoot` runs after module init | integration |
| TC-384 | Plugin declaring missing dependency → init throws | integration |
| TC-385 | Plugin overriding a built-in DI token replaces the implementation | integration |
| TC-386 | Plugin can NOT override a security-locked service (e.g., `JwtSigner`) — init throws | integration |
| TC-387 | Two plugins overriding the same token → init throws with clear error | integration |
| TC-388 | Plugin's migration runs once per database | integration |
| TC-389 | Plugin's admin UI manifest exposed on `/auth/admin/api/plugins` | integration |
| TC-390 | Plugin version pinning: plugin declares incompatible core version → init throws | integration |
| TC-391 | Disabling a built-in plugin (e.g., `mfa`) removes its routes | integration |
| TC-392 | Plugin context (DI access to core services) works as documented | integration |

---

## B. Client — `@ackplus/nest-auth-client`

All B-tests boot a **real backend in-process** in `beforeAll` and configure `AuthClient` against `http://localhost:<port>`. No HTTP mocking.

### B.1 AuthClient core (P0)

| ID | Test | Type |
|---|---|---|
| TC-400 | `login()` stores tokens via adapter, sets status | integration (real backend) |
| TC-401 | `signup()` happy path | integration |
| TC-402 | `logout()` clears storage, emits event | integration |
| TC-403 | `verifySession()` on 200 sets session | integration |
| TC-404 | `verifySession()` on 401 clears state (full cleanup, not partial) | integration |
| TC-405 | `refresh()` updates tokens | integration |
| TC-406 | `switchTenant()` updates session.tenantId | integration |
| TC-407 | `setMode('cookie')` toggles transport | integration |
| TC-408 | All public methods reject with `AuthError` on network failure (kill backend mid-call) | integration |

### B.2 Refresh queue (P0)

| ID | Test | Type |
|---|---|---|
| TC-420 | Single refresh works | integration |
| TC-421 | 10 concurrent 401s → 1 refresh hits backend, all 10 retried (verified by backend hit counter) | integration |
| TC-422 | Refresh fails → all 10 callers reject with same error | integration |
| TC-423 | `retryTracker` enforces single retry per request | integration |
| TC-424 | Refresh promise timeout (recommended 30s) — all callers reject, no hang | integration |
| TC-425 | New 401 after refresh completed → fresh refresh starts | integration |

### B.3 Storage adapters (P0)

These ARE genuinely unit-testable since storage is a pure interface.

| ID | Test | Type |
|---|---|---|
| TC-440 | MemoryStorage: get/set/remove/clear | unit |
| TC-441 | LocalStorageAdapter: SSR-safe (no crash when `window` undefined) | unit |
| TC-442 | LocalStorageAdapter: quota exceeded surfaces error | unit |
| TC-443 | SessionStorageAdapter parity | unit |
| TC-444 | CookieStorageAdapter: respects attributes | unit |
| TC-445 | Custom adapter (interface compliance) | unit |
| TC-446 | Async adapter (Promise-returning) works | integration (with real backend) |

### B.4 HTTP adapters (P1)

| ID | Test | Type |
|---|---|---|
| TC-460 | FetchAdapter: GET/POST/PUT/PATCH/DELETE against real backend | integration |
| TC-461 | FetchAdapter: timeout via `AbortController` (backend sleeps 10s, client timeout 1s) | integration |
| TC-462 | FetchAdapter: network error returns typed `AuthError` | integration |
| TC-463 | AxiosAdapter parity | integration |
| TC-464 | Custom adapter compliance | integration |
| TC-465 | `credentials: 'include'` in cookie mode (verified by backend reading cookie) | integration |

### B.5 Token utilities (P1)

| ID | Test | Type |
|---|---|---|
| TC-480 | `decodeJwt()` parses real JWT signed by backend | unit |
| TC-481 | `decodeJwt()` returns null on malformed token | unit |
| TC-482 | `isTokenExpired()` true past `exp` | unit |
| TC-483 | `getTokenExpirationDate()` returns Date | unit |
| TC-484 | `getUserIdFromToken()` extracts `sub` | unit |

### B.6 Event emitter (P1)

| ID | Test | Type |
|---|---|---|
| TC-500 | `on()` registers listener | unit |
| TC-501 | `off()` removes listener | unit |
| TC-502 | `once()` fires once then auto-removes | unit |
| TC-503 | `emit()` calls all listeners | unit |
| TC-504 | `emitAsync()` awaits async listeners | unit |
| TC-505 | Listener throwing doesn't stop other listeners | unit |

### B.7 Role utils (P2)

| ID | Test | Type |
|---|---|---|
| TC-520 | `hasRole()` exact match | unit |
| TC-521 | `hasRole()` checks across tenants | unit |
| TC-522 | `hasPermission()` checks role+permission | unit |
| TC-523 | `hasAnyAccess()` / `hasAllAccess()` semantics | unit |

---

## C. React — `@ackplus/nest-auth-react`

All C-tests render with a **real `AuthClient` against a real backend**. No mocked context.

### C.1 Provider (P0)

| ID | Test | Type |
|---|---|---|
| TC-600 | `AuthProvider` initial state from real client | component (jsdom + real backend) |
| TC-601 | SSR `initialState` hydrates without flicker | component |
| TC-602 | `onTokensSet` callback fires when client sets tokens | component |
| TC-603 | `onTokensRemoved` callback fires on logout | component |
| TC-604 | `getSessionData()` refetches user from real backend | component |
| TC-605 | Provider unmount cancels in-flight requests | component |

### C.2 Hooks (P0)

| ID | Test | Type |
|---|---|---|
| TC-620 | `useNestAuth()` returns context value | component |
| TC-621 | `useNestAuth()` outside provider throws | component |
| TC-622 | `useUser()` returns current user | component |
| TC-623 | `useSession()` returns session | component |
| TC-624 | `useAccessToken()` returns token in header mode, null in cookie mode | component |
| TC-625 | `useAuthStatus()` returns `loading`/`authenticated`/`unauthenticated` | component |
| TC-626 | `useHasRole()` reactive on role change (real role grant on backend, then refetch) | component |
| TC-627 | `useHasPermission()` reactive on permission change | component |
| TC-628 | All hooks re-render on relevant state change only (perf) | component |

### C.3 Guards (P1)

| ID | Test | Type |
|---|---|---|
| TC-640 | `<AuthGuard>` renders children when authenticated | component |
| TC-641 | `<AuthGuard>` renders fallback when not | component |
| TC-642 | `<AuthGuard onUnauthenticated>` fires callback | component |
| TC-643 | `<GuestGuard>` is inverse | component |
| TC-644 | `<RequireRole>` enforces role | component |
| TC-645 | `<RequirePermission>` enforces permission | component |
| TC-646 | `withRequireRole()` HOC works | component |
| TC-647 | Guards handle loading state correctly (no flash) | component |

### C.4 Next.js helpers (P1)

| ID | Test | Type |
|---|---|---|
| TC-660 | `getServerAuth()` reads cookies from App Router `cookies()` (real Next test runtime) | integration |
| TC-661 | `getServerAuth()` reads cookies from Pages Router request | integration |
| TC-662 | Middleware redirects unauth users | integration |
| TC-663 | `NextAuthProvider` hydrates from server props | integration |
| TC-664 | Server action helper works | integration |

### C.5 Cross-tab sync (P1)

| ID | Test | Type |
|---|---|---|
| TC-680 | Login in tab A propagates to tab B (BroadcastChannel) — Playwright with two browser contexts | E2E |
| TC-681 | Logout in tab A logs out tab B | E2E |
| TC-682 | `localStorage` fallback when BroadcastChannel unavailable | E2E |
| TC-683 | Sync ignores own messages (no loop) | unit |

---

## D. Contracts — `@ackplus/nest-auth-contracts`

| ID | Test | Type |
|---|---|---|
| TC-700 | `tsc --noEmit` passes for every consumer importing each public symbol | CI |
| TC-701 | `api-extractor` check: no breaking type changes between releases | CI |

---

## E. End-to-end user journeys (P0)

Each is one Playwright test against the real stack (backend + admin UI + example-next).

| ID | Journey |
|---|---|
| TC-800 | Signup → verify email → login → access protected page → logout |
| TC-801 | OAuth: signup with Google (stub) → identity stored → re-login with Google |
| TC-802 | Forgot password: request reset → click email link → set new password → login |
| TC-803 | MFA setup: login → enable TOTP → log out → log in → enter TOTP → access |
| TC-804 | Recovery code: use recovery code → log in → regenerate codes |
| TC-805 | Magic link: enter email → click link → logged in |
| TC-806 | Multi-tenant (SHARED): user belongs to A + B → switch tenant → roles change |
| TC-807 | Multi-tenant (ISOLATED): same email in tenant A and B → log in to each independently |
| TC-808 | Cross-tab: login in tab 1 → tab 2 auto-authenticates |
| TC-809 | Cross-tab: logout in tab 1 → tab 2 auto-logs-out |
| TC-810 | Refresh: leave tab idle past access-token expiry → action triggers silent refresh |
| TC-811 | Refresh fail: invalidate refresh on server → next action redirects to login |
| TC-812 | Admin: create user → assign role → user logs in → role takes effect |
| TC-813 | Admin: impersonate user → audit logged → exit impersonation |
| TC-814 | Admin: revoke user session → user's tab gets 401 on next action |

---

## F. Security suite (P0)

| ID | Test | Type |
|---|---|---|
| TC-900 | SQL injection payloads in every DTO field rejected/escaped | integration |
| TC-901 | XSS payload in user fields not reflected in admin UI | E2E |
| TC-902 | CSRF: state-changing request without CSRF token rejected (if CSRF enabled) | integration |
| TC-903 | Rate limit: 6th login attempt within window → 429 | integration |
| TC-904 | Account lockout after N failures (configurable) | integration |
| TC-905 | JWT signature tampered → 401 | integration |
| TC-906 | JWT `alg: none` rejected | integration |
| TC-907 | Refresh token replay (use after rotation) → 401 + session revoked | integration |
| TC-908 | Session fixation: pre-login session id ≠ post-login | integration |
| TC-909 | Timing attack on password compare (statistical) | unit |
| TC-910 | Account enumeration: signup-existing, forgot-unknown, login-unknown all return same shape | integration |
| TC-911 | OTP brute force: 5 wrong → lockout | integration |
| TC-912 | Cross-tenant access attempt: tenant A user requests tenant B resource → 403 | integration |
| TC-913 | Admin secret key never logged | integration |
| TC-914 | Password never appears in error response | integration |
| TC-915 | OpenAPI spec passes Spectral lint | CI |
| TC-916 | Dependencies scanned for known CVEs (`npm audit`, Snyk) | CI |
| TC-917 | OWASP ZAP baseline scan against example-nest | CI (nightly) |
| TC-918 | JWT with wrong `iss` / `aud` / not-yet-valid `nbf` claim → 401 — distinct from signature-tamper (TC-905) and `alg:none` (TC-906) | integration |
| TC-919 | Concurrent double-use of a single OTP / reset / recovery code (real `Promise.all` race) → exactly one succeeds, the other 401 — TC-041 only covers sequential reuse | integration |
| TC-920 | Password length boundary: bcrypt 72-byte truncation does NOT let a longer password validate against a truncated prefix (Argon2id has no such limit) | unit |
| TC-921 | Oversized input DoS guard: a very long password / field (e.g. 100 KB) is rejected with 400 BEFORE hashing is attempted | integration |
| TC-922 | Unicode / homoglyph + case-folding email is normalized consistently; lookalike-character collisions handled per the normalization policy | integration |
| TC-923 | Null-byte / control-character injection in email / phone / identifier is rejected or sanitized (no truncation-based bypass) | integration |
| TC-924 | OAuth callback `state` parameter is validated (CSRF on the OAuth flow); missing/mismatched `state` → rejected — distinct from form CSRF (TC-902) | integration |

---

## G. Admin UI tests (P1)

### G.1 Component tests

| ID | Test |
|---|---|
| TC-1000 | Login page submits credentials, redirects on success |
| TC-1001 | Login page shows error on 401 |
| TC-1002 | Users page lists users with pagination |
| TC-1003 | Users page search debounces 300ms |
| TC-1004 | Users page filters apply correctly |
| TC-1005 | Bulk select + bulk delete |
| TC-1006 | User detail tabs render |
| TC-1007 | User detail form: unsaved changes guard |
| TC-1008 | Role assignment dialog |
| TC-1009 | Form validation errors surface |
| TC-1010 | Theme switcher persists to localStorage |

### G.2 E2E (Playwright against real backend)

| ID | Test |
|---|---|
| TC-1050 | Admin logs in → reaches dashboard |
| TC-1051 | Admin creates user → user appears in list |
| TC-1052 | Admin creates role → assigns permissions |
| TC-1053 | Admin creates tenant → adds member |
| TC-1054 | Admin revokes session → user logged out |
| TC-1055 | Admin impersonates user → can act as them |
| TC-1056 | Admin views audit log |
| TC-1057 | Admin uses Cmd+K to navigate |
| TC-1058 | Admin exports user list to CSV |

---

## H. Performance / Load (P2)

| ID | Test |
|---|---|
| TC-1100 | 1,000 concurrent signups complete with <1% errors |
| TC-1101 | 10,000 concurrent logins, p99 < 500ms |
| TC-1102 | 100k sessions in DB — query perf doesn't degrade |
| TC-1103 | Refresh under burst (500 concurrent 401s) → 1 refresh, all retry |
| TC-1104 | Redis session store: 50k ops/sec sustained |
| TC-1105 | Admin user list with 1M users — pagination + search remain <1s |

---

## I. Migration / upgrade tests (P1)

| ID | Test |
|---|---|
| TC-1200 | 1.x → 2.0 migration: existing user data preserved |
| TC-1201 | Schema migration is reversible |
| TC-1202 | `sessions.tenantId` migration from JSON column → real column doesn't lose data |
| TC-1203 | Mode change DISABLED → SHARED: existing users get default tenant |

---

## J. Regression tests (locked to `.tasks/`)

Every fixed task gets a permanent regression test:

| TC | `.tasks/` ref | What |
|---|---|---|
| TC-2001 | 001 | Admin login validates password |
| TC-2002 | 002 | Plaintext password not logged |
| TC-2003 | 003 | Email provider returns user id, not email |
| TC-2004 | 004 | Phone provider returns user id, not phone |
| TC-2008 | 008 | Session onRevoked reason is dynamic |
| TC-2009 | 009 | Session touch interval is configurable |
| TC-2010 | 010 | OAuth providers consistent skipMfa |
| TC-2011 | 011 | Google email_verified gate works |
| TC-2012 | 012 | GitHub error differentiation |
| TC-2017 | 017 | switchTenant rejects in DISABLED |
| TC-2018 | 018 | DISABLED rejects tenantId |
| TC-2019 | 019 | ISOLATED actually isolates (post-fix) |
| TC-2020 | 020 | Refresh preserves tenantId |
| TC-2021 | 021 | Email unique per mode (post-fix) |
| TC-2022 | 022 | sessions.tenantId is queryable column |
| TC-2024 | 024 | MFA tenant scoping per mode |

---

## K. React Native + Social Login (P1)

Design: [`react-native-and-social-login.md`](react-native-and-social-login.md). Native auth UI can't run headless, so split into CI-testable (real tests, no mocks) and device/E2E.

### K.1 CI-testable (real backend + stubs + real adapters)

| ID | Test | Type |
|---|---|---|
| TC-RN-1 | `socialLogin('github', token)` posts the correct login DTO and returns tokens | integration (real backend + GitHub stub) |
| TC-RN-2 | `socialLogin` defaults `createUserIfNotExists: true` | integration |
| TC-RN-3 | `socialLogin` propagates `tenantId` (shared mode) | integration |
| TC-RN-4 | `socialLogin` surfaces `isRequiresMfa` and stores pending tokens | integration (MFA enabled) |
| TC-RN-5 | `AsyncStorageAdapter` get/set/remove/clear round-trip (always-async) | unit (real adapter) |
| TC-RN-6 | `TokenManager.ready()` warms mirror from AsyncStorage before first sync read | integration |
| TC-RN-7 | `SecureStorageAdapter` interface compliance | unit (real keychain fake) |
| TC-RN-8 | `SocialAuthProvider` fake `signIn()` token flows into `socialLogin` | integration (real fake provider, not a mock) |
| TC-RN-9 | Google native adapter maps native result → `{ token, type: 'idToken' }` | unit |
| TC-RN-10 | Apple native adapter forwards first-sign-in name/email | unit |
| TC-RN-11 | Backend Google login works against a stubbed token verifier | integration (real backend + injectable verifier) |
| TC-RN-12 | Backend Apple login accepts + persists first-sign-in name/email | integration |

### K.2 Device / E2E (Detox or manual — not unit CI)

| ID | Test |
|---|---|
| TC-RN-E2E-1 | Real Google native sign-in (iOS + Android) → authenticated |
| TC-RN-E2E-2 | Real Apple Sign In (iOS) → authenticated, name captured first time |
| TC-RN-E2E-3 | Token persists across app restart (Keychain) |
| TC-RN-E2E-4 | Silent refresh when access token expires in-app |

---

## L. Compliance & Healthcare (P0/P1)

Design: [`compliance-and-healthcare.md`](compliance-and-healthcare.md). Real tests, no mocks — these tighten §F (Security) for HIPAA / NIST 800-63B / GDPR / DPDP.

| ID | Test | Maps to gap |
|---|---|---|
| TC-CMP-1 | Login throttled after N attempts in window → 429 | C-1 |
| TC-CMP-2 | Account locks after N failed logins; admin unlock; lockout audit event | C-2 |
| TC-CMP-3 | OTP / reset endpoints throttled | C-1 |
| TC-CMP-4 | `FAILED_LOGIN` event emitted with actor / ip / reason | C-3 |
| TC-CMP-5 | Admin action (user CRUD, role change, impersonation, session-revoke) emits audit event | C-3 |
| TC-CMP-6 | Persistent audit store is append-only; rows hash-chained / tamper-evident | C-3 |
| TC-CMP-7 | Break-glass grant is time-boxed, requires reason, emits high-severity audit + alert, auto-expires | C-4 |
| TC-CMP-8 | Breached password rejected on signup/change/reset (k-anonymity) | C-5 |
| TC-CMP-9 | `@RequireRecentAuth` blocks a sensitive route when last auth older than max age → step-up | C-6 |
| TC-CMP-10 | Concurrent-session limit enforced (oldest evicted or new blocked) | C-7 |
| TC-CMP-11 | Consent grant/withdraw recorded with versioned purpose + events | C-8 |
| TC-CMP-12 | `exportUserData` returns full auth footprint; `eraseUser` deletes/anonymizes + audits | C-9 |
| TC-CMP-13 | Idle timeout rejects session after idle window; absolute timeout enforced | (existing, tighten) |
| TC-CMP-14 | `compliance: 'hipaa'` preset flips documented safe defaults | C-12 |
| TC-CMP-15 | `complianceReport()` lists active/inactive controls; CI asserts required-on | C-12 |
| TC-CMP-16 | Cookie `secure`+`sameSite=strict` under healthcare preset; startup warns if off | C-10 |

---

## Test data strategy

- **Fixtures:** `test/fixtures/` — typed factories using `@faker-js/faker` to build real entity instances (no fake repositories — they're inserted via real TypeORM).
- **Scenarios:** `test/scenarios/` — pre-built setups (multi-tenant, MFA-enrolled user, etc.) that perform real inserts.
- **DB lifecycle:**
  - One Postgres container per Vitest worker (shared across files in that worker).
  - `beforeAll`: run migrations.
  - `beforeEach`: `TRUNCATE` all tables (real SQL, cascading).
  - `afterAll`: stop container.
- **Boot strategy:**
  - Backend tests: `Test.createTestingModule({ imports: [TestAppModule] }).compile() → app.init()` per file.
  - Client tests: spin up backend in-process, expose URL, configure `AuthClient`.

---

## CI integration (proposed)

```yaml
jobs:
  test:
    matrix:
      package: [contracts, nest-auth, client, react]
      node: [20, 22]
    services:
      postgres: { image: postgres:16 }
      redis: { image: redis:7 }
    steps:
      - lint (eslint + prettier)
      - tsc --noEmit
      - unit + integration tests (vitest)
      - coverage threshold check (fail if <80%)
  e2e:
    services: [postgres, redis]
    steps:
      - build all packages
      - boot example-nest + example-next + admin UI
      - playwright test
  security:
    steps:
      - npm audit
      - spectral lint openapi.json
      - OWASP ZAP baseline (nightly only)
  perf:
    schedule: weekly
    steps:
      - k6 run perf/*.js
```

---

## Implementation priority

**Week 1 — foundation (~60 tests)**
- Testcontainers + Vitest harness in `nest-auth`
- Real-backend boot helper for `nest-auth-client` tests
- TC-001 to TC-053 (signup + login)

**Week 2 — sessions + MFA + RBAC (~120 tests)**
- TC-090 to TC-215, all P0 regressions

**Week 3 — tenants + OAuth + admin (~140 tests)**
- TC-230 to TC-322

**Week 4 — client + react + e2e (~150 tests)**
- TC-400 to TC-683, TC-800 to TC-814

**Week 5+ — security, perf, admin UI, plugin system (~80 tests)**

---

## Verification

This catalog is complete when:
- Every test in this list has a corresponding `.spec.ts` file in the right package.
- CI runs every test on every PR.
- Coverage thresholds met per package.
- No file in `packages/*/test/` contains the strings `vi.mock(`, `jest.mock(`, or `MockRepository`.
- Every closed item in `.tasks/` (status: fixed) has a regression test in section J.

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) — overall delivery plan
- [`013-no-test-coverage-on-any-package.md`](013-no-test-coverage-on-any-package.md) — original task
- [`005-build-openapi-script-is-stub.md`](005-build-openapi-script-is-stub.md) — OpenAPI infra is a Phase 1 dependency
