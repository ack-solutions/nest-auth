# @ackplus/nest-auth

## 2.8.0

### Minor Changes

- **SECURITY HARDENING** — closes the P0 findings from the auth security audit: fail-closed secrets, a two-wave admin-console lockdown, and a suite of opt-in brute-force / CSRF / password / verification protections. Most changes default to today's behavior; the exceptions are called out under BREAKING below.

  **BREAKING (opt-out / action needed):**
  - `session.jwt.secret` is now **required** — a missing or known-weak secret throws at boot (was a silent `'secret'` default). A merely-short (<32 char) secret still only warns unless you set `session.jwt.validateSecretStrength: true`.
  - The `'jwt'` login provider is now **opt-in** — enable it explicitly with `session.jwt.enableLoginProvider: true` (was auto-registered whenever `session.jwt` existed; it trusts any token signed with the secret, so it must be turned on deliberately).
  - Admin console: `adminConsole.secretKey` / `adminConsole.sessionSecret` under 32 chars (or known-weak) now **throw at boot**. Provide a strong key or disable the console.
  - Admin session signing key is now **derived** from `secretKey` (`sha256("nest-auth-admin-session:" + secretKey)`) when no dedicated `adminConsole.sessionSecret` is set → admin sessions minted by older versions are invalidated; admins re-login once. A dedicated `sessionSecret` is used verbatim.
  - Admin login is **throttled by default** (429 after ~5/60s). Opt out with `adminConsole.bruteForce.enabled: false`; tune via `security.rateLimit.buckets`.
  - Admin session cookie is now **Secure unless `NODE_ENV` is explicitly `development` or `test`** (was: Secure only when `NODE_ENV === 'production'`, so staging/unset/misconfigured prod shipped it in cleartext). Opt out with `adminConsole.cookie.secure: false`.
  - Admin DTO validation + an **8-char admin password floor** are now enforced regardless of your global `ValidationPipe` (controller-scoped pipe + an unconditional backstop in the entity `setPassword`).
  - Social-login account-linking now requires a **verified provider email** — a new social identity won't silently attach to an existing account by unverified email (401 `SOCIAL_EMAIL_NOT_VERIFIED`); account creation is still allowed. Opt out with `social.requireVerifiedEmailForLinking: false`.
  - Also default-on: admin `POST <admin>/signup` is now **bootstrap-only** (403 `ADMIN_BOOTSTRAP_CLOSED` once an admin exists — create further admins via the session-guarded `POST <admin>/admins`), opt out with `adminConsole.allowPublicSignupAfterFirstAdmin: true`; admin `signup`/`reset-password` now also respect `adminConsole.allowAdminManagement`.

  **Added (opt-in — default off, no behavior change until enabled):**
  - **Built-in CSRF for cookie auth** — `security.csrf.enabled`. Double-submit token: a non-httpOnly `nest_auth_csrf` cookie is issued/rotated on login + refresh (and admin login); the server requires `x-csrf-token` == cookie (timing-safe) on state-changing methods, plus an optional Origin/Referer allowlist. `GET /auth/csrf` for cross-domain SPAs. Bearer/header auth is unaffected.
  - **Rate limiting** — `security.rateLimit.enabled`. Per-bucket window/max on login, signup, forgot-password, passwordless/OTP send + verify, MFA verify, and admin login; `keyBy: 'ip' | 'identifier' | 'both'`; 429 + `Retry-After`. Pluggable `IRateLimitStore` (in-memory default; supply Redis for multi-instance).
  - **Password strength policy + HIBP breach check** — `password.policy`. Enforced uniformly at every set-password path (signup / change / reset / admin) inside the entity `setPassword`: `minLength` / `maxLength`, common-password + consumer blocklists, block-contains-identifier, and `checkBreached` via Have I Been Pwned (k-anonymity, fail-open).
  - **Email-verification gating** — `registration.requireVerifiedEmail`. An unverified user gets 403 `EMAIL_NOT_VERIFIED` on guarded routes (re-checked per request; `@SkipEmailVerification` for exceptions). The session is still issued at signup.
  - **Soft account lockout + CAPTCHA hook** — `security.lockout` (429 `ACCOUNT_LOCKED` after `maxFailedAttempts`, keyed by identifier + IP to avoid lockout-DoS) and `security.captcha` (provider-agnostic `verify(token, { ip })` on signup + forgot-password).
  - **Disposable / blocked email-domain screening** — `emailAuth.disposable` (`mode: 'block' | 'flag'`, `allowlist`). DB-backed blocklist seedable from a built-in ~8k default list; managed from a new admin-console "Blocked Emails" page.

  **Fixed:**
  - **Admin-console hardening (2 waves)** — bootstrap gating + dedicated/derived session-signing key; **revocable admin sessions** (per-admin `tokenVersion`; logout / password reset genuinely revoke outstanding cookies); anti-clickjacking headers on every admin route (`X-Frame-Options: DENY`, real CSP `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`); throttled + de-oracled secret-key endpoints (identical `ADMIN_BOOTSTRAP_CLOSED` after bootstrap regardless of key correctness); no login email-enumeration (dummy argon2 on admin-not-found); last-admin delete guard (409 `ADMIN_LAST_REMAINING`); revoke sessions on password change; escaped the injected `window.__NEST_AUTH_CONFIG__` JSON; the admin SPA now echoes the CSRF double-submit token (so enabling `security.csrf` no longer breaks the dashboard).
  - **Refresh-token reuse now revokes the whole session** on replay (kills the token family — OAuth 2.0 best practice; other devices untouched). Emits `REFRESH_TOKEN_REUSE_DETECTED`. Opt out with `session.refreshTokenReuse.revokeSession: false`.
  - **TOTP hardening** — device deletion scoped to owner (was an IDOR: any user could delete another's device); OTP verification attempts capped via `otp.maxAttempts` (default 5); codes use a CSPRNG (`crypto.randomInt`) over the full space instead of `Math.random()` / truncated hex.
  - **Auth guard enforces token type** — only `type: 'access'` authenticates a request (a refresh token presented as a Bearer access token is rejected); pre-`type` tokens are tolerated.
  - **Social login accepts `firstName` / `lastName` / `avatarUrl`** credential fields (fixes Apple's first-authorization-only name, which is never in the id_token) and stamps `emailVerifiedAt` / `phoneVerifiedAt` only when the provider proved it; social user lookups are now tenant-scoped.

### Patch Changes

- @ackplus/nest-auth-contracts@2.8.0


## 2.7.6

### Patch Changes

- feat(user): `UserService.getTenantsByEmail` / `getTenantsByPhone` for
  app-owned email/phone-first tenant pickers (cross-tenant, active-only,
  no public HTTP endpoint).
  - @ackplus/nest-auth-contracts@2.7.6

## 2.7.5

### Patch Changes

- feat(auth): richer public `/auth/client-config` for login/signup UIs
  - Returns passwordless `{ enabled, allowSignUp }`, OAuth public ids
    (`google.clientId`, `facebook.appId`, `apple.clientId`, `github.clientId`),
    `customProviders`, `platformAccess.enabled`, and `accessTokenType`.
  - Secrets are never included. Extend further via `clientConfig.factory`.
  - @ackplus/nest-auth-contracts@2.7.5

## 2.7.4

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.4

## 2.7.3

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.3

## 2.7.2

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.2

## 2.7.1

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.1

## 2.7.0

### Minor Changes

- feat: platform-user listing + passwordless login completion
  - **List platform users without scanning every tenant.** `UserService` gains
    `getPlatformUsers(options?)`, `getPlatformUsersAndCount(options?)`, and
    `getPlatformUsersByRole(roleName, guard?)` — the list analog of
    `getPlatformUserByEmail`. They scope to the `NestAuthPlatformAccess` marker
    (caller `where`/`relations`/`skip`/`take`/`order` are honored), so an admin
    "Platform Users" screen no longer has to fetch all users and filter client-side.
  - **Complete a passwordless sign-in from the client.** `AuthClient.passwordlessLogin(dto)`
    and the React `useNestAuth().passwordlessLogin(dto)` exchange the emailed/texted
    code for a session (the completion step for `passwordlessSend`), returning a
    normal auth response. New `IPasswordlessLoginRequest` type (`{ identifier, code,
channel?, tenantId?, rememberMe? }`); `channel` defaults to trying both email and
    SMS. Wraps `POST /auth/login` with the existing passwordless provider — no backend
    change.

  Both additions are backward-compatible (new methods/types only). React Native
  consumers get `passwordlessLogin` for free via the shared `AuthClient`.

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.0

## 2.6.0

### Patch Changes

- @ackplus/nest-auth-contracts@2.6.0

## 2.5.2

### Patch Changes

- fix(nest-auth): tenant-less platform (super-admin) user provisioning under ISOLATED

  Add first-class `UserService.createPlatformUser(data)` and `UserService.getPlatformUserByEmail(email)` so a platform (super-admin) account can be provisioned and looked up without a tenant — even when `TENANT_MODE=isolated`, where the plain `createUser` / `getUserByEmail` require a `tenantId` and previously threw `TENANT_ID_REQUIRED` (breaking admin-bootstrap on every boot).

  A platform user is identified by the `NestAuthPlatformAccess` marker (the same row the login path enforces), not merely a tenant-less `userAccess` — so `createPlatformUser` atomically establishes that marker and `getPlatformUserByEmail` never returns a regular tenant-less account (correct in SHARED/DISABLED too, not just ISOLATED).

  Internally this threads an explicit, request-independent `platform` opt-in through the tenant-requirement layer (`requiredTenant`, `TenantService.checkRequiredTenant` / `resolveTenantId`, and `UserService.createUser` / `getUserByEmail` / `getUserByPhone`): a platform context is never tenant-scoped and never requires a tenant. All new parameters are optional and default to the previous behavior — no change for existing callers.
  - @ackplus/nest-auth-contracts@2.5.2
