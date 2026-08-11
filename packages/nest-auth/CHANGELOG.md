# @ackplus/nest-auth

## 2.9.2

### Patch Changes

- **Fixed (MFA config) — `mfa.methods` now replaces the default instead of being
  merged with it.** The config was deep-merged twice (`NestAuthModule.getOptions`
  then `AuthConfigService.setOptions`), and deepmerge concatenates arrays, so a
  consumer that set `mfa.methods: ['totp']` silently got `['email', 'totp']` at
  runtime — a TOTP-only (or email-only) setup was impossible. A caller-provided
  `methods` list now replaces the default `[EMAIL, TOTP]`; the default applies
  only when `methods` is omitted. `roleGuards` is unchanged. Backend-only, no API
  shapes changed, SDKs unchanged (lockstep bump).
  - @ackplus/nest-auth-contracts@2.9.2

## 2.9.1

### Patch Changes

- **Security (MFA) — closed a password-only MFA bypass.** Every route on the MFA
  controller was `@SkipMfa()`, so the challenge-stage token that login issues
  before the second factor (`isMfaEnabled && !isMfaVerified`) could reach the
  routes that **change** MFA config. An attacker with only the victim's password
  could `setup-totp` → `verify-totp-setup` their own authenticator → satisfy the
  challenge with it. Fixed: `setup-totp`, `verify-totp-setup`,
  `generate-recovery-code`, `toggle`, and device deletion now require a fully
  **MFA-verified** session — a challenge-stage token gets `401`. The routes a
  locked-out user needs (`status`, `challenge`, `verify`, `reset-totp`, device
  list) still accept the challenge token. **First-time enrolment is unaffected**
  (a user with MFA off has no challenge in progress).

  Behavior note: if a custom UI called `setup-totp` / `generate-recovery-code`
  with the *pending* challenge token during the login challenge, it must now
  complete `mfa/verify` first. No standard flow is affected.

- **Fixed (MFA) — `reset-totp` could permanently lock out a TOTP-only user.**
  Resetting via a recovery code deleted the TOTP secrets and consumed the code
  but left `isMfaEnabled: true`. For a user with no other verified method that is
  the invalid "MFA on, zero methods" state — the next login returned
  `isRequiresMfa` with an empty method list and the recovery code was already
  spent. `reset-totp` now turns MFA off when no verified method remains (and
  emits `TWO_FACTOR_DISABLED`); if a verified email/SMS method survives, MFA
  stays on.

- **Fixed (MFA) — `defaultMfaMethod` in the login response now matches the user.**
  It was taken from the app config unconditionally, so a response could say
  `mfaMethods: ['email']` with `defaultMfaMethod: 'totp'` and a client honouring
  the field would prompt for an authenticator the user doesn't have. It now uses
  the configured default only if the user actually has it, else their first
  available method.

  No client/SDK changes — the `-client`, `-react`, `-react-native`, and Flutter
  packages are unchanged in this release (lockstep version bump only). No API
  shapes changed.
  - @ackplus/nest-auth-contracts@2.9.1

## 2.9.0

### Minor Changes

- No backend changes. Released in lockstep with a client-side fix: the JS/TS and
  Flutter SDKs no longer destroy a session on an **indeterminate** failure
  (network / timeout / 429 / 5xx) — only a definitive **401/403** ends a session.
  See `@ackplus/nest-auth-client@2.9.0`.
  - @ackplus/nest-auth-contracts@2.9.0

## 2.8.5

### Patch Changes

- **Fixed (backend) — every social login 500'd on Postgres with `invalid input syntax for type uuid`.**
  Google, Apple, Facebook and GitHub logins — plus the opt-in `jwt` login
  provider and any custom SSO provider — were broken on Postgres. Their
  `validate()` returns the provider's EXTERNAL subject (the OAuth `sub` /
  account id, e.g. Google's `109961585847656477769`) as `AuthProviderUser.userId`,
  but `AuthService.login`'s post-`validate()` "is this a known user?" lookup fed
  that value straight into the `uuid` `auth_identity.userId` column, so Postgres
  rejected it and the request 500'd. SQLite/`sqljs` doesn't enforce column types,
  so the in-memory test suite never reproduced it — on `sqljs` the same path
  quietly returned `INVALID_CREDENTIALS` (401) instead. Only Google had been
  exercised in the wild; Apple/Facebook/GitHub were broken identically.

  The lookup now resolves by the external subject (`providerId`) for these
  providers, matching what `handleSocialLogin` already does. Introduced an
  exported `SocialAuthProvider` base (Google/Apple/Facebook/GitHub now extend it;
  the `jwt` provider applies the same fix) and a new provider seam
  `findLinkedIdentity(validated)` — the default resolves by our `userId`,
  social/external providers override to resolve by `providerId`. `findIdentityByUserId`
  keeps meaning "by our user id" (no more overloading it). **Custom SSO/social
  providers should now extend `SocialAuthProvider` instead of `BaseAuthProvider`**
  so they inherit the correct lookup and don't hit the same crash. Real-DB
  regression tests cover an existing social identity logging in with
  `createUserIfNotExists: false` (the path that 500'd on Postgres / 401'd on
  `sqljs`).
  - @ackplus/nest-auth-contracts@2.8.5

## 2.8.4

### Patch Changes

- **Admin console — Tenants module + role-guard filters now show consistently.**
  Every config-driven admin surface (the Tenants nav, the tenant column/filter on
  Users, the tenant filter on Roles, tenant fields on user detail, and the
  role-guard filters on Roles/Permissions) is driven by `GET /auth/client-config`.
  A signal inconsistency — the layout/Roles/user-detail keyed off
  `tenants.enabled === true` while the Users page keyed off `tenantMode !== null` —
  meant an app that set `tenant.mode` without `tenant.enabled: true` got the
  Tenants nav hidden while the user-list tenant column still showed. `tenantEnabled`
  is now derived from the resolved tenant mode, so all surfaces use ONE signal
  (tenant UI is on whenever a mode is resolved / tenants aren't explicitly
  disabled). A failed `/client-config` load also now logs a clear console warning
  (URL + status) instead of silently rendering an empty admin — the usual cause of
  "Tenants/guards are missing" is a wrong base path or an unconfigured global
  prefix. Rebuilt the admin bundle.
  - @ackplus/nest-auth-contracts@2.8.4

## 2.8.3

### Patch Changes

- **MFA fixes:**

  - **TOTP QR shows your app name, not "SecretKey".** `setupTotpDevice` built the
    `otpauth://` URI with no issuer/label (speakeasy's default is `"SecretKey"`), so
    `mfa.totp.issuer` was never used. The URI now carries the configured issuer
    (fallback `appName`), the user's email as the account label, and the configured
    period. `POST /auth/mfa/setup-totp` accepts an optional `{ label?, deviceName? }`
    body — and `client.setupTotp(body)` / the React `setupTotp(body)` forward it — so
    a multi-tenant app can disambiguate one person's several accounts under the same
    issuer, e.g. `label: "ada@acme.com (Acme Corp)"`. The response now includes
    `otpAuthUrl`, `issuer`, and `account`; new contract type `ISetupTotpRequest`.
  - **`GET /auth/mfa/status` reports `allowUserToggle` / `canToggle` from policy**, not
    from the user's current MFA state. Previously a member with MFA off got
    `canToggle: false`, so self-service two-factor could never be switched on — even
    though the toggle endpoint (`canUserToggleMfa`) would have accepted it. The status
    now mirrors the real gate (`enabled` + `allowUserToggle` + `!required`).

  - @ackplus/nest-auth-contracts@2.8.3

## 2.8.2

### Patch Changes

- Version-only re-publish (identical code to 2.8.1).
  - @ackplus/nest-auth-contracts@2.8.2

## 2.8.1

### Patch Changes

- **Fixes from consumer feedback on 2.8.0:**

  - **`forRootAsync` can mint tokens again.** JwtService (and TokenResponseInterceptor /
    BaseAuthProvider) now read module options LAZILY instead of capturing them at
    construction. Under `forRootAsync`, CoreModule initialises before the async options
    provider runs `setOptions()`, so a captured reference was the empty default — every
    login 500'd with "Missing session.jwt.secret". This also removes a latent pre-2.8.0
    hazard where `forRootAsync` could sign tokens with the insecure default secret.
  - **Custom auth providers work via `forRoot`.** A `BaseAuthProvider` passed in
    `customAuthProviders` no longer needs manual repository wiring — the provider registry
    injects the user/identity repositories and the config deep-merge preserves the provider
    instance's methods. `new MyProvider(opts)` just works.
  - **`NestAuthBlockedEmailDomain` is now exported** from `NestAuthEntities` and the public
    barrel, so a migration DataSource built from `...NestAuthEntities` can create the
    blocked-email-domains table.
  - **Browser-safe error codes.** `@ackplus/nest-auth-contracts` now exports
    `NestAuthErrorCode` — a typed enum of every error `code` the server emits (including the
    2.8.0 and admin codes). A drift-guard test keeps it in sync with the server.
  - **MFA surfaces the OTP reason.** `MfaService.verifyMfa` re-throws the coded reason
    (expired / invalid / "too many attempts, request a new code") instead of collapsing to a
    generic failure, matching the password-reset flow. **Behavior note:** a wrong MFA code now
    returns the specific `VERIFICATION_CODE_*` code rather than `MFA_CODE_INVALID`.
  - **Security surfaces on the barrel.** The `@RateLimit` / `@Captcha` / `@Lockout`
    decorators, their guards, and the rate-limit bucket types are now exported for reuse on
    your own routes.
  - **Cross-tab refresh lock (client).** `AuthClient.refresh()` serializes refreshes across
    browser tabs (Web Locks API) so two tabs of the same account no longer log each other out
    via refresh-token reuse detection. Graceful fallback where Web Locks is unavailable
    (React Native / SSR / older browsers); backend unchanged.

  - @ackplus/nest-auth-contracts@2.8.1

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
