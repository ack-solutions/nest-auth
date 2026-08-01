# Security Review & Productization Plan — `@ackplus/nest-auth`

*Prepared for the library maintainer. Scope: the deeper "how would a hacker actually break auth" surface — token/session integrity, authorization & multi-tenancy, account-linking takeover, admin console, OTP/MFA, cookies/CSRF. The earlier signup-abuse audit (disposable email, aliasing, enumeration, weak OTP RNG, no rate limit) is referenced only where it intersects. Every finding below was code-verified; each is marked **Confirmed** or **Plausible**, and one candidate was **Rejected** on verification and dropped.*

All paths are relative to `packages/nest-auth/src/`.

---

## A) What security gaps can a hacker exploit?

### Ranked findings (most exploitable first)

Ranking weights real-world exploitability: unauthenticated account takeover, token/session forgery, authorization/IDOR, and account-linking takeover sit at the top.

| # | Gap | Sev | Attack (one line) | Where | Fix (summary) | Status |
|---|-----|-----|-------------------|-------|----------------|--------|
| 1 | Default JWT signing secret is the literal `'secret'`, never strength-validated | **Critical** | Sign `{sub:victimId}` with `'secret'`, POST `/auth/login {providerName:'jwt'}` → real session as anyone, no password | `core/services/auth-config.service.ts:24-26`; `core/providers/jwt-auth.provider.ts:29-47`; `auth/services/auth.service.ts:307-343` | Remove default; throw at `setOptions` if unset/blocklisted/<32B (mirror admin-secret validation); don't auto-enable JwtAuthProvider | Confirmed |
| 2 | Password-reset OTP has **no attempt cap** and no throttle | **Critical** | Knowing only the victim email, brute-force the 6-digit code on public `/auth/verify-forgot-password-otp` → reset token → password reset | `auth/services/otp-flow.service.ts:123-153`; `auth/entities/otp.entity.ts:10-29`; `auth/controllers/auth.controller.ts:349-375` | Add `attempts`/`lockedUntil` to OTP entity, cap+invalidate in `validateAndConsume`, throttle by identity+IP | Confirmed |
| 3 | `'jwt'` provider launders **any** internally-issued token into a fresh 30-day session | **High** | Replay a stolen 1h access token to `/auth/login {providerName:'jwt'}` → new session that survives victim logout & evades reuse-detection | `core/providers/jwt-auth.provider.ts:32-47`; `auth/services/auth.service.ts:324-424` | Don't enable implicitly; require a dedicated `aud`/`iss` internal tokens never carry; reject `type` in `access`/`refresh` | Confirmed |
| 4 | Unauthenticated admin **password-reset & admin-creation** gated only by shared `secretKey`; bypasses `allowAdminManagement`; unthrottled | **High** | POST `/auth/admin/reset-password {secretKey,email,newPassword}` overwrites any admin's password; `/signup` mints super-admins — even when `allowAdminManagement:false` | `admin-console/controllers/admin-auth.controller.ts:72-105, 277-314` | Gate both behind `allowAdminManagement()`; disable public bootstrap after first admin; rate-limit; OOB-notify | Confirmed |
| 5 | Admin **session-signing key == bootstrap `secretKey`**, only blocklist-validated (no entropy floor) | **High** | A low-entropy operator secret (`mycompany2024`) is brute-forced offline against a captured admin cookie → forge `{sub:adminId}` → global super-admin | `admin-console/services/admin-console-config.service.ts:44-47`; `admin-console/services/admin-session.service.ts:19-33` | Separate high-entropy `adminConsole.sessionSecret` (≥32B, fail closed); enforce min length, not just blocklist | Confirmed |
| 6 | Social login **links to a pre-existing local user by raw email**, no `email_verified` gate | **High** | Sign in via a provider asserting `victim@corp.com` unverified (FB/Apple-web/GitHub-fallback/Google `email_verified:false`) → attacker identity linked to victim's account → session as victim | `auth/services/auth.service.ts:836-874` | Require `providerUser.emailVerified===true` before auto-linking to an existing account; else require logged-in confirm/OOB | Confirmed |
| 7 | Social auto-provisioning **hardcodes `emailVerifiedAt=now`** for unverified provider emails | **High** | Attacker seeds `victim@corp.com` via unverified provider → account permanently stamped "verified" → poisons reset-gating & squats identity | `auth/services/auth.service.ts:847` | Set `emailVerifiedAt` only when `providerUser.emailVerified===true` | Confirmed |
| 8 | Google **access-token path never verifies `aud`/`azp`** (confused deputy) | **High** | Victim signs into attacker's own Google app; attacker submits that access token with client-controlled `type:'accessToken'` → logged in as victim | `core/providers/google-auth.provider.ts:86-119`; `auth/dto/credentials/social-credentials.dto.ts:27` | Reject unless `tokenInfo.aud===clientId`; prefer removing the access-token path; ignore client `type` downgrade | Confirmed |
| 9 | JWT **type-confusion**: refresh token accepted as access token by the guard | **High** | Send `Authorization: Bearer <refreshToken>` → authenticates every route for up to 30d, bypassing `/refresh` rotation | `core/services/jwt.service.ts:68-84`; `auth/guards/auth.guard.ts:241-308` | Assert `payload.type==='access'` in guard/verify; `'refresh'` only in refresh flow; add & pin `aud`/`typ` | Confirmed |
| 10 | **MFA email/SMS OTP** shares the uncapped verify path | **High** | With the victim's password, brute-force the 6-digit second factor on `/auth/mfa/verify` → fully MFA-verified session | `auth/services/mfa.service.ts:195-212`; `auth/services/auth.service.ts:625-645` | Per-user MFA attempt cap + cooldown; throttle `/mfa/verify` (TOTP unaffected) | Confirmed |
| 11 | **Pre-MFA (first-factor-only) token can disable MFA / mint recovery codes** via `@SkipMfa` routes | **High** | With only the password, POST `/mfa/generate-recovery-code`, `/mfa/reset-totp`, or `/mfa/toggle {enabled:false}` before completing 2FA | `auth/controllers/mfa.controller.ts:86-111, 217-234`; `auth/guards/auth.guard.ts:378-401` | Require an MFA-verified session (or step-up) for all state-changing MFA ops | Confirmed |
| 12 | **No CSRF** on cookie-authenticated mutations (admin console + main API cookie mode) | **High** | With `sameSite:'none'` (mandatory cross-domain), `evil.com` auto-submits credentialed POSTs → rogue-admin creation, user deletion | `admin-console/guards/admin-session.guard.ts:29-46`; `auth/guards/auth.guard.ts:203-220` | Double-submit token on unsafe methods + Origin/Referer allowlist; refuse `sameSite:'none'` unless CSRF enabled | Confirmed |
| 13 | **Admin cookie not `Secure` in production** — shipped `secure:false` default overrides the env gate | **High** | On-path attacker captures the `nest_auth_admin` JWT from one cleartext request; it's unrevocable (2h) → full admin control | `core/services/auth-config.service.ts:58-62`; `admin-console/services/admin-console-config.service.ts:53-70` | Drop `secure:false` default; `secure = config.cookie?.secure ?? (NODE_ENV==='production')`; force Secure when `sameSite:'none'` | Confirmed |
| 14 | Public SSO callback **reflects arbitrary query params** into `postMessage(...,'*')` | **High→Med** | `/auth/callback/:provider?success=true&accessToken=…` reflects attacker fields under the trusted `nest-auth-sso-callback` type; wildcard origin leaks to any framer | `auth/controllers/auth.controller.ts:572-667` | Pin `postMessage` to a configured origin; do the real code-for-token exchange server-side; add `frame-ancestors` | Confirmed |
| 15 | Authorization reads a **stale role/permission snapshot** from the session | **Medium** | A just-demoted user (or admin-password-reset user) keeps elevated authority until the access token expires | `auth/guards/auth.guard.ts:430-444`; `admin-console/controllers/admin-users.controller.ts:490-505` | On role/permission/password mutation call `revokeAllUserSessions`, or check a monotonic permissions-version in the guard | Confirmed |
| 16 | **IDOR**: any authenticated user can delete another user's TOTP device | **Medium** | `DELETE /mfa/devices/:id` runs `delete({id})` with no `userId` scope → downgrade victim to single-factor (needs the device UUID) | `auth/services/mfa.service.ts:416-420`; `auth/controllers/mfa.controller.ts:129-144` | `delete({id, userId})` — mirror the correct admin path | Confirmed |
| 17 | Social login user lookup **not tenant-scoped** — cross-tenant linking | **Medium** | In multi-tenant mode, a social login in tenant B links/returns a user owned by tenant A (same email, no global unique index) | `auth/services/auth.service.ts:839` | Scope the `findOne` by resolved `tenantId`, like `findIdentity` | Confirmed |
| 18 | **Incomplete refresh-token reuse detection** — replay rejected but family not revoked, no signal | **Medium** | Attacker who refreshes first keeps a valid chain; victim silently bounced to re-login; defenders get no alert | `auth/services/auth.service.ts:925-934` | On stored-hash mismatch, `revokeSession(id,'security')` + emit auditable `reuse-detected` | Confirmed |
| 19 | Admin sessions are **unrevocable stateless JWTs** (logout is a no-op) | **Medium→Low** | A stolen/forged admin token stays valid its full lifetime through logout, deletion, and password reset | `admin-console/services/admin-session.service.ts:84-89` | Back with a revocable jti/token-version store; shorten default lifetime | Confirmed |
| 20 | Admin SPA served with **no anti-clickjacking / CSP / nosniff headers** | **Medium** | Framed admin dashboard + UI-redress → destructive clicks (full when admin cookie `sameSite:'none'`) | `admin-console/controllers/admin-console.controller.ts:82-98` | `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'`, `nosniff`, restrictive CSP on SPA + SSO callback | Confirmed |
| 21 | Apple **web authorization-code path decodes id_token without verification** | **Medium** | Exchanged `id_token` is `decodeToken`'d — no signature/`aud`/`iss`/`exp` check; a token for another Service ID links/creates accounts | `core/providers/apple-auth.provider.ts:234` | Verify against Apple JWKS (`RS256`, `aud`, `iss`) — reuse `verifyIdentityToken` | Confirmed |
| 22 | Apple native **nonce check is a no-op** (replayable) | **Medium** | Both nonce and token are client-supplied in the same request; the check is skipped entirely if nonce omitted → replay a captured identityToken | `core/providers/apple-auth.provider.ts:151-157` | Server-generate & store a per-attempt nonce; compare token nonce to the stored value; require it | Confirmed |
| 23 | Facebook token accepted **without app-audience verification** (no `debug_token`/`appsecret_proof`) | **Medium** | A token minted for the attacker's own FB app is honored by Graph `/me` → email flows into linking → account takeover | `core/providers/facebook-auth.provider.ts:44-62` | `GET /debug_token`, reject unless `app_id===appId && is_valid`; send `appsecret_proof` | Confirmed |
| 24 | Numeric OTP uses **`Math.random()`** (non-CSPRNG) across all OTP flows | **Medium** | PRNG-state recovery / shrunk effective space compounds the uncapped-verify brute force on reset & MFA codes | `utils/otp.ts:5`; `core/services/auth-config.service.ts:75` | `crypto.randomInt` (rejection-sampled); pairs with the attempt-cap fix | Confirmed |
| 25 | **TOTP secrets stored in plaintext at rest** (no encryption, no `select:false`) | **Medium** | Any DB read (SQLi elsewhere, backup/replica theft) yields every user's TOTP seed → full second-factor bypass | `auth/entities/mfa-secret.entity.ts:16`; `auth/services/mfa.service.ts:254` | Encrypt seed with a dedicated key; `select:false` | Confirmed |
| 26 | Every admin is an **unscoped global super-admin** — guard authorizes on session existence only | **Low** | One admin credential = read/modify/delete every tenant's users/roles/permissions/tenants; no containment | `admin-console/guards/admin-session.guard.ts:25-46` | Introduce admin roles/permissions + tenant-scope claim; at minimum document the single-tier model | Confirmed |
| 27 | **Session id not rotated on privilege elevation** (MFA verify reuses id) | **Low** | Session fixation surface for any cookie/session-id-anchored deployment (mitigated in default header-token mode) | `auth/services/auth.service.ts:647-652`; `session/services/session-manager.service.ts:226` | Call the existing-but-unused `rotateSession()` on MFA verify | Confirmed |
| 28 | Permission search builds `LIKE` from raw input **without escaping wildcards** | **Low** | A lone `%` matches all rows (name enumeration/filter bypass); many wildcards force costly scans (not SQLi) | `permission/services/permission.service.ts:193-195` | Reuse `escapeLikePattern` (already used for user search) + `ESCAPE` clause | Confirmed |
| 29 | **Single shared secret** reused as HMAC key across 5 unrelated purposes | **Low** | No domain separation — one leak compromises signing + all HMAC-based invalidation at once | `auth/entities/otp.entity.ts:36`; `session-token.service.ts:44`; `password.service.ts:78` | HKDF-derive purpose-specific subkeys; drop silent fallbacks to `session.jwt.secret` | Confirmed |
| 30 | Alphanumeric OTP is **hex-only and truncated**, halving entropy | **Low** | `randomBytes(len).toString('hex').substring(0,len)` → 16-symbol alphabet, half the bytes discarded (only if `format:'alphanumeric'`) | `utils/otp.ts:7` | Encode over full base32/base62 sized to length, no truncation | Confirmed |
| 31 | Admin session JWT **verified without algorithm pinning** | **Low** | Not exploitable with a string secret today; latent if the key ever becomes a key object | `admin-console/services/admin-session.service.ts:40` | Pin `algorithms:['HS256']` + explicit `iss`/`aud` | Confirmed |
| 32 | `resetMfa` **doesn't clear `isMfaEnabled` / revoke sessions**; verification OTPs also uncapped | **Low** | Recovery leaves an MFA-required account with no usable device (lockout); email/phone verification codes brute-forceable | `auth/services/mfa.service.ts:442-471`; `auth/services/verification.service.ts:140-147` | Clear `isMfaEnabled` + revoke on reset; apply the OTP attempt-cap to verification | Confirmed |
| 33 | No `iss`/`aud`/`nbf` on tokens (info-level hardening) | **Info** | Cross-service token replay where a secret is shared; underpins findings #3/#9 | `core/services/jwt.service.ts:25-84` | Set & verify `iss`/`aud`; keep the existing HS256 pinning | Confirmed |
| 34 | OAuth `state`/PKCE/`redirect_uri` entirely delegated to the client | **Info** | Integrators wrongly assume the library provides OAuth-CSRF; it can't (token-submission design) | `auth/dto/credentials/social-credentials.dto.ts:7-14` | Document that clients MUST enforce `state`/PKCE/exact `redirect_uri` | Confirmed |
| — | Hardcoded fallback admin secret `'change-me-admin-secret'` | Info | Near-unreachable dead code under standard init (validation throws first) | `admin-console/services/admin-console-config.service.ts:44-47` | Remove the fallback; throw if called unconfigured | Confirmed (inert) |

**Rejected on verification (do not fix as stated):** *"Admin console enabled by default with a hardcoded fallback signing secret"* — both attack paths are already closed: `setOptions` forces `enabled:false` when `secretKey` is unset, and `validateAdminConsoleOptions` throws at boot on the placeholder value. The residual **Low** is only that a weak-but-not-blocklisted secret (`admin123`) passes with no entropy floor — captured by finding #5.

### We checked these — they are correct (no change needed)

- **Main JWT verify pins `algorithms:['HS256']`** (`jwt.service.ts:77,169`) — `alg=none` and HS/RS confusion are blocked. Apple native path pins `RS256` with `aud`+`iss`. Google **id_token** branch pins audience.
- **`exp` enforced**; **tokens never accepted from the query string** (header+cookie only).
- **Per-request session lookup gates auth** (`auth.guard.ts:257-300`) — logout and password-change revocation genuinely invalidate old access tokens; they aren't trusted statelessly.
- **Password-reset tokens are single-use**: HMAC bound over the *full current password hash*, timing-safe rechecked; they auto-invalidate on password change. They are **not** accepted as access tokens (no `sessionId` claim → guard rejects).
- **`changePassword` / `resetPasswordWithToken` call `revokeAllUserSessions`.**
- **`forgotPassword` returns an identical message** on found/not-found — no enumeration there.
- **OTP, recovery codes, and trusted-device tokens are stored only as HMAC hashes** with timing-safe compare; **recovery codes are high-entropy** (`randomBytes(20)`) — not brute-forceable.
- **JWKS / GitHub API URLs are config-sourced, not request-controlled** — no SSRF; **no `res.redirect`/`Location` sink exists** — no open redirect.

---

## B) Email signup — did we miss config?

The email-signup security surface is largely **absent from config today**. The prior audit flagged the policy gaps; here is the *config completeness* view — what a knob should exist for, and whether it does:

| Signup security knob | Exists today? | Gap |
|----------------------|:-------------:|-----|
| Server-enforced password policy (min length, blocklist) | ❌ (hash/argon2 only) | No `password.policy.*`; add min/max length, common-password blocklist, breach (HIBP) check |
| Breached-password (HIBP) check | ❌ | Missing; propose `password.policy.checkBreached` |
| Disposable-email screening | ❌ (only a code comment) | No list, no `emailAuth.disposable.*`; must be built |
| Email canonicalization (case-fold, Gmail dot/`+tag`) | ❌ | No `emailAuth.canonicalize.*`; enables alias multi-account today |
| `requireVerifiedEmail` gating | ❌ | Not a config field; unverified accounts can act, and social auto-verify (#7) poisons the signal |
| Enumeration-safe signup responses | ⚠️ partial | `forgotPassword` is generic; signup path is not — propose `registration.enumerationSafe` |
| Rate limit / lockout / CAPTCHA on signup | ❌ | No `@nestjs/throttler` anywhere in the library |
| CSPRNG + attempt-cap on verification OTP | ❌ | `Math.random()` + uncapped `validateAndConsume` (#24, #32) |
| DB unique index on identity (`(tenantId, canonicalEmail)`) | ❌ | Relies on TypeORM `synchronize`; no migration ships one |
| `login.createUserIfNotExists` honored from client body | ⚠️ **hazard** | Attacker-settable; part of the `'jwt'`-provider ATO chain (#3). Server must ignore the client value |

**Verdict:** the email-signup config surface is the *least* complete area. Section C proposes the full set; all knobs are opt-in with back-compat defaults.

---

## C) What config options will we give?

Full productization surface, grounded against `core/interfaces/auth-module-options.interface.ts`, `session-options.interface.ts`, `mfa-options.interface.ts`, `IOtpOptions`, `IAdminConsoleOptions`. **EXISTING** keys are never renamed; **PROPOSED** keys are opt-in and default to today's behavior.

**Conventions** — *Settable-where*: `CODE/ENV-ONLY` (from `forRoot(Async)`/`process.env`, never dashboard) · `DASHBOARD-OK` (a behavioral knob safe to expose *after* the admin-console RBAC/CSRF/revocation fixes land). *Sensitivity*: `SECRET` · `DEPLOY` · `BEHAVIORAL`.

> **Bright line (the crux of the audit):** `session.jwt.secret`, every `*.clientSecret`/`*.appSecret`/`*.privateKey`, `mfa.trustedDeviceSecret`, `mfa.totpEncryptionKey`, `otp.secret`, `adminConsole.secretKey`, the proposed `adminConsole.sessionSecret`, CAPTCHA/HIBP keys, `cookie.secure`/`sameSite`, `cors.origins`, and DB/Redis strings are **CODE/ENV-ONLY** and structurally excluded from the admin SPA.

### 1. Token / Session — `session.*`

| Key | Type | Default (safe-default callout) | Where | Sens. | Why |
|---|---|---|---|---|---|
| `session.jwt.secret` *(EXISTING)* | string | **ships `'secret'` — INSECURE.** Safe: ≥32B random, no default | CODE/ENV-ONLY | SECRET | HS256 key; default = full forgery |
| `session.jwt.validateSecretStrength` *(PROPOSED)* | bool | `false` → **`true`** | CODE/ENV-ONLY | DEPLOY | Fail-closed on missing/weak/<32B |
| `session.jwt.issuer` / `.audience` *(PROPOSED)* | string / string[] | `undefined` | CODE/ENV-ONLY | DEPLOY | Set+verify `iss`/`aud`; blocks cross-service reuse |
| `session.jwt.keys {access,refresh,reset,hmac}` *(PROPOSED)* | object | HKDF-derived from `secret` | CODE/ENV-ONLY | SECRET | Domain-separate per purpose |
| `session.jwt.enforceTokenType` *(PROPOSED)* | bool | `false` → **`true`** | CODE/ENV-ONLY | BEHAVIORAL | Guard asserts `type==='access'` (kills #9) |
| `session.accessTokenValidity` *(EXISTING)* | num/str | `'1h'` → prod `'15m'–'1h'` | CODE/ENV | BEHAVIORAL | Bounds stolen-token window |
| `session.refreshTokenValidity` *(EXISTING)* | num/str | `'30d'` → prod `'7d'–'30d'` | CODE/ENV | BEHAVIORAL | Amplifies reuse gap when long |
| `session.reuseDetection.enabled` / `.action` *(PROPOSED)* | bool / `'reject'|'revokeFamily'` | `false`/`'reject'` → **`true`/`'revokeFamily'`** | CODE/ENV | BEHAVIORAL | Contain theft on replay (#18) |
| `session.rotateOnPrivilegeElevation` *(PROPOSED)* | bool | `false` → **`true`** | CODE/ENV | BEHAVIORAL | `rotateSession()` on MFA verify (#27) |
| `session.revokeOnRoleChange` *(PROPOSED)* | bool | `false` → **`true`** | DASHBOARD-OK | BEHAVIORAL | Fixes stale snapshot (#15) |
| `session.permissionsVersionCheck` *(PROPOSED)* | bool | `false` → prod `true` | CODE/ENV | BEHAVIORAL | Guard checks monotonic version |
| `session.maxSessionsPerUser` *(EXISTING)* / `.concurrentSessionPolicy` *(PROPOSED)* | num / enum | `10` / `'evictOldest'` | DASHBOARD-OK | BEHAVIORAL | Concurrent-session cap |
| `session.accessTokenType` *(EXISTING)* | `'header'|'cookie'|null` | `null` | CODE/ENV | DEPLOY | `cookie` mandates CSRF (block 4) |
| `session.storageType` / `session.redis.*` *(EXISTING)* | enum / obj | `database` / — | CODE/ENV(-ONLY) | DEPLOY/SECRET | `memory` never in prod; Redis URL is secret |

### 2. Cookies — `session.cookieOptions.*` + `adminConsole.cookie.*`

| Key | Default (callout) | Where | Sens. |
|---|---|---|---|
| `cookieOptions.httpOnly` *(EXISTING)* | `true` | CODE/ENV | DEPLOY |
| `cookieOptions.secure` *(EXISTING)* | **effectively `false` off-prod — must be `true` in prod; force `true` when `sameSite:'none'`** | CODE/ENV-ONLY | DEPLOY |
| `cookieOptions.sameSite` *(EXISTING)* | `'lax'` (`'none'` only with CSRF) | CODE/ENV-ONLY | DEPLOY |
| `cookieOptions.domain` / `.path` *(EXISTING)* | host-only / `'/'` | CODE/ENV(-ONLY) | DEPLOY |
| `adminConsole.cookie.secure` *(EXISTING)* | **ships `false` — INSECURE (overrides env gate).** Safe: `config.cookie?.secure ?? (NODE_ENV==='production')` | CODE/ENV-ONLY | DEPLOY |
| `adminConsole.cookie.sameSite` / `.httpOnly` *(EXISTING)* | `'lax'` / `true` | CODE/ENV-ONLY | DEPLOY |
| `cookieOptions.__Host_prefix` *(PROPOSED)* | `false` → prod `true` | CODE/ENV-ONLY | DEPLOY |

### 3. CORS + Security headers — `security.cors.*`, `security.headers.*` *(PROPOSED)*

| Key | Default | Where | Sens. |
|---|---|---|---|
| `cors.enabled` / `.origins` / `.credentials` | `false` / `[]` (never `'*'`) / `false` | CODE/ENV-ONLY | DEPLOY |
| `headers.enabled` | `false` → **`true`** | CODE/ENV | DEPLOY |
| `headers.frameAncestors` | `'none'` (X-Frame-Options DENY on SPA + SSO callback) | CODE/ENV-ONLY | DEPLOY |
| `headers.contentTypeOptions` | `true` (nosniff) | CODE/ENV | DEPLOY |
| `headers.hsts` / `headers.csp` | `false` / restrictive | CODE/ENV-ONLY | DEPLOY |
| `sso.postMessageOrigin` | **currently `'*'` — INSECURE.** Safe: configured origin(s) | CODE/ENV-ONLY | DEPLOY |

### 4. CSRF — `security.csrf.*` *(PROPOSED)*

| Key | Default | Where |
|---|---|---|
| `csrf.enabled` | `false` → **`true` for cookie mode** | CODE/ENV |
| `csrf.mode` | `'both'` (doubleSubmit + originCheck) | CODE/ENV |
| `csrf.allowedOrigins` | `[]` | CODE/ENV-ONLY |
| `csrf.cookieName` | `'nest_auth_csrf'` | CODE/ENV |
| `csrf.refuseSameSiteNone` | `true` (couples the two knobs) | CODE/ENV |

### 5. Rate limiting — `security.rateLimit.*` *(PROPOSED)*

Master `enabled` `false` → **`true`**; `store` `'memory'` → prod **`'redis'`** (memory is per-instance, useless behind multiple pods); `keyBy` `'ipAndIdentity'`. Per-route buckets `{windowMs,max}` — `login {60s,5}`, `forgotPassword {60s,3}`, `verifyOtp {60s,5}`, `mfaVerify {60s,5}`, `signup {60s,5}`, `adminSecretRoutes {60s,3}`, `refresh {60s,30}`. Buckets are `DASHBOARD-OK`; `store`/origins are `CODE/ENV-ONLY`.

### 6. Account lockout — `security.lockout.*` *(PROPOSED)*

`enabled` `false`→**`true`** (CODE/ENV); `maxFailedAttempts` `10`, `window` `'15m'`, `lockDuration` `'15m'`, `strategy` `'exponential'`, `notifyOnLock` `false`→prod `true` (all `DASHBOARD-OK`).

### 7. CAPTCHA — `security.captcha.*` *(PROPOSED)*

`enabled` `false`; `provider` (`turnstile`/`recaptcha`/`hcaptcha`/`custom`); `secretKey` **CODE/ENV-ONLY SECRET**; `verify` custom hook; `routes` `['signup','forgotPassword']`; `minScore` `0.5` (`DASHBOARD-OK`).

### 8. Password policy — `password.policy.*` *(PROPOSED, extends EXISTING `password`)*

`enabled` `false`→**`true`**; `minLength` `8`→**`12`**; `maxLength` `128` (argon2 DoS guard); `blocklist` `'top10k'`; `checkBreached` `false`→**`true`** (HIBP k-anonymity, no key needed); `hibpApiKey` (**SECRET, never dashboard**); `requireCharClasses` `null` (NIST favors length+blocklist). `password.passwordResetTokenExpiresIn` *(EXISTING)* → prod `'15m'–'30m'`. `password.argon2.*` *(EXISTING)* keep ≥ OWASP floor.

### 9. Email auth — `emailAuth.disposable.*` + `emailAuth.canonicalize.*` *(PROPOSED, extends `{enabled}`)*

- **disposable**: `enabled` `false`→**`true`**; `mode` `'flag'`→prod **`'block'`**; `listSource` `'builtin'`; `allowlist` `[]` (DASHBOARD-OK); `matchSubdomains` `true`; `resolveMx` `false`→prod optional `true`.
- **canonicalize**: `enabled` `false`→**`true`**; `lowercase` `true`; `providerAware` `true`; `stripPlusTag` `true`; `stripDots` `'gmailOnly'`; `storeCanonicalKey` `false`→**`true`** (needs the DB unique index — §16).

### 10. Registration — `registration.*` (extends EXISTING) + enumeration safety

`registration.enabled` *(EXISTING)*; `requireVerifiedEmail` *(PROPOSED)* `false`→**`true`**; `enumerationSafe` *(PROPOSED)* `false`→**`true`**; `autoLoginAfterSignup` *(EXISTING)* → `false` when verification required; `requireInvitation` *(EXISTING)*; `passwordless.allowSignUp` *(EXISTING)* keep `false`. **Hardening:** `login.createUserIfNotExists` — **stop honoring the client-supplied DTO flag** (part of #3).

### 11. OTP — `otp.*` (extends EXISTING `IOtpOptions`) + `mfa.otp.*`

`otp.secret` *(EXISTING)* — **set explicit; stop the silent `jwt.secret` fallback** (SECRET). `otp.length` `6`; `otp.format` `'numeric'`; `otp.csprng` *(PROPOSED)* `false`→**`true`** (`crypto.randomInt`); `otp.maxAttempts` *(PROPOSED)* **∞→`5`** (the core brute-force fix); `otp.invalidateOnMaxAttempts` *(PROPOSED)* →**`true`**; `otp.cooldown` *(PROPOSED)* `0`→**`'60s'`**; `otp.codeExpiresIn` *(EXISTING)* `'30m'`→prod **`'10m'`**; `otp.alphanumericAlphabet` *(PROPOSED)* base32, no truncation (#30).

### 12. MFA — `mfa.*` (extends EXISTING `MFAOptions`)

`enabled`/`required`/`methods` *(EXISTING)*; `requireVerifiedSessionForChanges` *(PROPOSED)* `false`→**`true`** (fixes #11); `stepUpForDisable` *(PROPOSED)* →**`true`**; `enforceDeviceOwnership` *(PROPOSED)* →**`true`** (fixes #16); `encryptTotpSecretAtRest` *(PROPOSED)* →prod **`true`** + `totpEncryptionKey` (**SECRET**) (fixes #25); `resetClearsEnabledState` *(PROPOSED)* →**`true`** (fixes #32); `trustedDeviceSecret` *(EXISTING, SECRET, throws if unset)*; `mfaVerifyMaxAttempts` *(PROPOSED)* **∞→`5`** (fixes #10).

### 13. Social / OAuth (extends EXISTING) + link safety

Secrets (`*.clientSecret`/`appSecret`/`privateKey`) **CODE/ENV-ONLY**. `google.requireVerifiedEmail` `false`→**`true`**; `google.verifyAccessTokenAudience` *(PROPOSED)* →**`true`** (fixes #8); `google.allowAccessTokenPath` *(PROPOSED)* `true`→**`false`**; `facebook.verifyAppId` *(PROPOSED)* →**`true`** (fixes #23); `apple.verifyWebCodeIdToken` *(PROPOSED)* →**`true`** (#21); `apple.enforceNonce` *(PROPOSED)* →**`true`** (#22); `social.requireProviderEmailVerified` *(PROPOSED)* →**`true`** (fixes #6); `social.setEmailVerifiedOnlyWhenProven` *(PROPOSED)* →**`true`** (fixes #7); `social.tenantScopedLinking` *(PROPOSED)* →**`true`** (fixes #17); `social.ignoreClientVerificationType` *(PROPOSED)* →**`true`** (fixes the `type` downgrade). Document that clients must enforce `state`/PKCE/`redirect_uri`.

### 14. Admin console — `adminConsole.*` (extends EXISTING `IAdminConsoleOptions`)

`enabled` *(EXISTING)* `true`→**require explicit `true`**; `secretKey` *(EXISTING, SECRET, bootstrap gate — must not double as signing key)*; `sessionSecret` *(PROPOSED)* **require distinct ≥32B** (fixes #5); `secretMinEntropyBytes` *(PROPOSED)* `0`→**`32`**; `pinAlgorithm` *(PROPOSED)* →**`true`** (#31); `statefulSessions` *(PROPOSED)* →**`true`** (fixes #19); `sessionDuration` *(EXISTING)* `'2h'`→prod `'30m'–'1h'`; `allowAdminManagement` *(EXISTING)*; `gatePublicRoutesByManagement` *(PROPOSED)* →**`true`** (fixes #4); `disablePublicBootstrapAfterFirstAdmin` *(PROPOSED)* →**`true`**; `roles` *(PROPOSED)* RBAC (fixes #26); `settingsEditable` *(PROPOSED const `false`)* — explicit guarantee no SECRET/DEPLOY key is ever dashboard-editable.

### 15. Audit / logging — `audit.*` (extends EXISTING)

`audit.enabled` `false`→**`true`**; `onEvent` hook; `events` *(PROPOSED)* add `refresh_reuse_detected`, `mfa_bypass_attempt`, `admin_bootstrap`, `lockout`; `redactPII` *(PROPOSED)* →prod `true`; `logFailedAuth` *(PROPOSED)* →**`true`**. `debug.*` — **off in prod** (never leak token/secret material).

### 16. Infrastructure guardrails (outside `AuthModuleOptions`)

- **`synchronize:false` in prod; ship migrations** (none exist today).
- **Add unique index** on `(tenantId, canonicalEmail)` and `(tenantId, provider, providerUserId)`.
- **Don't rely on `NODE_ENV` for `cookie.secure`** — it's frequently unset behind a proxy, which is exactly why the current gate is dead code.
- **All SECRETs** from a secrets manager, distinct per purpose, ≥32B, rotated.

> **Deep-merge footgun:** `AuthConfigService` deep-merges with **array CONCAT** (deduped only for `mfa.methods`/`roleGuards`). Every new array key (`cors.origins`, `disposable.allowlist`, `captcha.routes`, `password.policy.blocklist`, …) must be **replace-on-set or explicitly deduped**, and ship with `[]`/`undefined` defaults so concat cannot silently re-introduce a removed origin/route.

---

## D) What goes in the dashboard, and what must stay code/env?

**Governing rule:** a setting is dashboard-editable only if it is **(a) non-secret, (b) behavioral/policy, and (c) fail-safe when misconfigured** (a bad value tightens or annoys — it does not open a hole an attacker reaches). Everything that is a key, controls transport security, or is itself an exploit primitive stays code/env-only. This matters *doubly* here because the admin console today is a **single-tier, unscoped, irrevocable-session super-admin surface** — letting it rewrite security-critical values would turn any admin-cookie compromise into a config takeover.

### Safe to expose (behavioral, non-secret, fail-safe)

`registration.enabled`, `requireInvitation`, `requireVerifiedEmail` · `disposable.mode`/`allowlist`/`denylist` · `email.canonicalize.*` (warn: retroactive change can collide existing rows — never auto-merge) · `password.minLength`/`requireClasses` (**dashboard may only make stricter — hard floor in code**) · `lockout.*` · `otp.maxAttempts`/`cooldown` (directly mitigates the critical uncapped-OTP ATO; both directions bounded by code) · `rateLimit` bucket sizes (code ceiling so dashboard only tightens) · `session.accessTokenValidity`/`refreshTokenValidity` (**code-clamped max**) · `mfa.required`/`allowUserToggle` (surface with a warning — `required:false`+`allowUserToggle:true` enables the pre-MFA bypass #11) · concurrent-session cap · `audit.enabled` (**but the settings-audit stream itself must not be disableable**) · branding text (sanitize to prevent stored-XSS in the SPA).

### Must stay CODE/ENV-only

`session.jwt.secret` and all signing/HMAC keys · `adminConsole.secretKey`/`sessionSecret` · `mfa.trustedDeviceSecret`/`totpEncryptionKey` · social `clientId`/`clientSecret`/Apple `privateKey` · `cookie.secure`/`sameSite`/`httpOnly`/domain · CORS/`trustProxy`/HTTPS termination · DB connection/`synchronize` · `adminConsole.enabled`/`allowAdminManagement`/`basePath` · **and the locks/floors** (min-password-length floor, max-token-TTL ceiling) that make the "safe to expose" set safe.

### How to make dashboard settings actually work (architecture note)

Config today is compile-time `AuthModuleOptions` → `AuthConfigService.setOptions()` (deep-merge), consumed synchronously; there is **no persistence and no runtime mutation**. Editable settings require six new pieces:

1. **Persisted store** — `NestAuthSetting { key (PK), value jsonb, tenantId?, updatedBy, updatedAt }`; keys **allowlisted** to exactly the safe set (any other key → reject); optional `tenantId=null` global default + per-tenant overrides. Needs a schema sync/migration (none ship today) + a seed of defaults.
2. **Endpoints** — `GET /admin/settings` returns the *effective merged view* per key `{value, source:'code'|'db'|'default', locked, editable}` so the UI renders locked rows read-only; `PUT /admin/settings/:key` validates via `class-validator`, **clamps to the code floor/ceiling server-side**, bumps a version, emits audit. **Do not** reuse the current `AdminSessionGuard` as-is — settings-write is higher-privilege than user CRUD; require a dedicated `settings:write` permission (the RBAC layer the audit says is missing), a step-up re-auth, and **fix the revocation gap (#19) first**.
3. **Precedence & LOCKS** (do *not* reuse the array-concat deep-merge):
   ```
   effective(key) =
     code LOCKED         → code value        (DB ignored, shown read-only)
     else DB row exists  → clamp(DB value, code floor/ceiling)
     else code set       → code value
     else                → shipped default
   ```
   Integrators pass `settings: { locked:['password.minLength',…], floors:{...}, ceilings:{...} }`. A locked key can't be weakened; an unlocked-but-floored key is editable but clamped — so even a hostile admin moves only *within* the safe band. This is the mechanism that makes the "safe to expose" set safe.
4. **Caching / hot-reload** — a `SettingsService` cache keyed by a monotonic `settingsVersion`; on PUT, bump the version and invalidate across instances via the existing Redis pub/sub (session storage already supports Redis). Avoid per-request DB reads on the hot auth path.
5. **Audit** — every write emits `{event:'settings.changed', key, oldValue, newValue, adminId, ip, at}`; the settings-audit stream is not dashboard-disableable.
6. **UI rebuild** — the dashboard is a **prebuilt ~5.4MB static `index.html`** (source in a separate app); a Settings tab means rebuilding that SPA (add nav item to the `h0` sidebar, add forms, render locked rows read-only from the `source`/`locked` flags) and re-bundling the shipped asset.

---

## E) What differs dev vs prod?

**Design principle:** security-critical toggles should **default to the safe value and require explicit opt-out**, not silently key off `NODE_ENV` — because `NODE_ENV` is often unset behind a proxy, which is exactly how the current `secure` gate becomes dead code.

| Setting | DEV | PROD | Selected by | Failure mode if wrong |
|---|---|---|---|---|
| `cookie.secure` | `false` (localhost http) | **`true`** | should be `config.cookie?.secure ?? NODE_ENV==='production'` — **currently broken** (shipped `secure:false` overrides gate) | plaintext session/admin cookie → **theft** (highest-priority env fix) |
| `cookie.sameSite` | `lax` | `lax`/`strict` (`none` **only** with CSRF) | explicit | `none` without CSRF → CSRF on all cookie-mode mutations |
| HTTPS / `trustProxy` | off | **on** (TLS proxy) | explicit | wrong `trustProxy` → rate-limit/lockout keyed on proxy IP or spoofable `X-Forwarded-For` |
| CORS origins | `localhost:*` | **explicit allowlist** | explicit | `*`+credentials → cross-origin token/cookie leak |
| `requireVerifiedEmail` | `false` | **`true`** | explicit | unverified accounts act; compounds social auto-verify (#7) |
| Rate-limit / lockout | loose/off | **strict, on** | explicit | the uncapped-OTP critical ATO & MFA bypass become trivial |
| Disposable mode | `flag` | **`block`** | dashboard, prod-locked | throwaway-email abuse |
| Error verbosity / enumeration | verbose OK | **generic, enumeration-safe** | NODE_ENV | info leak / email harvesting |
| `accessTokenValidity` | long OK | **≤15m** | explicit, code-ceiling | longer stolen-token / type-confusion replay window |
| `refreshTokenValidity` | long OK | bounded + rotation + reuse-revoke | explicit | durable theft |
| `adminConsole` reachability | localhost | **network-restricted, TLS-only** | explicit | non-Secure/irrevocable/CSRF admin findings all go live |
| TypeORM `synchronize` | `true` | **`false`** (migrations) | explicit (**must not follow `NODE_ENV` silently**) | schema drift / dropped columns / **data loss** — library ships no migrations |
| Bootstrap admin `secretKey` | dev secret, test admin OK | **high-entropy; disable public `/signup`+`/reset-password` after first admin** | explicit | weak/leaked secret → forgeable super-admin + unauthenticated admin reset (#4/#5) |

---

## F) How do we see the default (disposable) list?

> The disposable feature **does not exist yet** (`grep disposable` hits only a comment in `auth.service.ts:348`; no list file, no config field). This is forward-looking design for a to-be-built list.

**Two layers, kept visibly distinct:**

- **Bundled baseline (read-only):** the generated corpus (~8k domains) produced *at build time* from an upstream source, shipped as a compiled artifact (e.g. `lib/.../disposable-domains.generated.ts`, *to be created*). Not editable in the dashboard — changing it means a package upgrade. Admin can **view and search only**.
- **Admin overrides (stored settings):** `disposable.allowlist` / `denylist` from §9, persisted in the Settings store (§D), layered at runtime. These **are** editable.

**Runtime decision** (allowlist beats denylist beats baseline, so an admin can always rescue a false positive without a release):
```
domain = canonicalize(email.domain)
if domain ∈ overrides.allowlist   → ALLOW
else if domain ∈ overrides.denylist → BLOCK
else if domain ∈ bundledBaseline  → apply disposable.mode (off/flag/block)
else                              → ALLOW
```

**Proposed endpoints:**
- `GET /admin/disposable/baseline?search=&page=&pageSize=50` → `{ total, version:"2026-07-generated", page, pageSize, items[] }` — **server-side pagination + search** (never ship 8k rows). Because the baseline is an in-memory array, use a plain substring `includes` filter — no SQL, sidestepping the `LIKE`-injection class entirely (and reuse `escapeLikePattern` anywhere a query does hit SQL — the audit found `searchPermissions` (#28) forgot it). Returns `version` so admins see how stale the snapshot is.
- `GET /admin/disposable/check?email=` → `{ canonicalDomain, decision, matchedBy:'allowlist'|'denylist'|'baseline'|'none' }` — explains *why* an address was blocked, for support, without editing anything.
- `GET/PUT /admin/settings/disposable` → `{mode, allowlist, denylist}` — validate/lowercase/dedupe/cap each domain; audit every change.

**Dashboard UX** (needs the SPA rebuild): a **Disposable Emails** section with a mode segmented control (prod-locked badge when code-locked), a read-only searchable/paginated **baseline** panel headed `Total: 8,054 · version 2026-07 · read-only (built into the package)`, and chip-input allow/deny editors that write to the Settings store with a `settings.changed` audit entry. The large corpus stays viewable-but-not-editable; the small override lists are the only mutable surface, behind the same permission-guarded, clamped, audited pipeline.

---

## G) Phased roadmap — what & how

Every item is **opt-in and backward-compatible** unless explicitly marked *behavior change* (those ship behind a flag defaulting to today's behavior, with a documented migration to the safe value). Effort is rough eng-time.

### P0 — Security fixes (ship first; several are near-zero-config server-side corrections)

Prioritizing unauthenticated ATO, token/session forgery & invalidation, authz/IDOR, and account-linking takeover.

| # | Item | Findings | Effort | Notes |
|---|------|----------|:------:|-------|
| P0-1 | **Fail-closed on `session.jwt.secret`** — remove `'secret'` default; throw at `setOptions` if unset/blocklisted/<32B | #1, #33 | S | *Behavior change* behind `validateSecretStrength` (default `false` one release, then `true`); the single highest-impact fix |
| P0-2 | **Enforce token `type`** at every consumption point (guard `'access'`, refresh `'refresh'`) | #9 | S | Add `enforceTokenType`; closes refresh-as-access |
| P0-3 | **Don't auto-enable JwtAuthProvider**; require dedicated `aud`/`iss`, reject internal `type` | #3 | S–M | Opt-in provider; stop honoring client `createUserIfNotExists` |
| P0-4 | **OTP attempt cap + invalidate + cooldown** in `validateAndConsume` (add `attempts`/`lockedUntil`) | #2, #10, #32 | M | Kills the critical unauthenticated reset ATO and MFA brute force; needs a column (migration) |
| P0-5 | **CSPRNG OTP** (`crypto.randomInt`) + fix alphanumeric truncation | #24, #30 | S | Drop-in |
| P0-6 | **Social linking requires `providerUser.emailVerified`; stop hardcoding `emailVerifiedAt=now`; tenant-scope the lookup** | #6, #7, #17 | M | *Behavior change* behind `social.requireProviderEmailVerified`/`setEmailVerifiedOnlyWhenProven`/`tenantScopedLinking` |
| P0-7 | **Google `aud` check; Facebook `debug_token`; Apple web verify + real nonce; ignore client `type`** | #8, #21, #22, #23 | M | Per-provider, opt-in flags defaulting safe in a major |
| P0-8 | **Gate admin `/signup`+`/reset-password` by `allowAdminManagement`; disable public bootstrap after first admin; rate-limit + notify** | #4 | M | Closes unauthenticated admin ATO |
| P0-9 | **Separate high-entropy `adminConsole.sessionSecret`; enforce entropy floor; pin `HS256`+`iss`/`aud`** | #5, #31 | S–M | Fixes offline-forgeable super-admin |
| P0-10 | **Admin cookie `Secure` default fix** (`?? NODE_ENV==='production'`; force when `sameSite:'none'`) | #13 | S | Remove the `secure:false` default |
| P0-11 | **MFA state-change routes require an MFA-verified session** (drop blanket `@SkipMfa` / add `isMfaVerified` check + step-up) | #11 | M | Fixes pre-MFA disable/recovery-mint |
| P0-12 | **IDOR fix**: `removeTotpDevice` scopes `{id, userId}` | #16 | XS | One-line, mirror admin path |
| P0-13 | **Revoke/refresh sessions on role/permission/password change** (or guard permissions-version) | #15 | M | Fixes stale-authz window |
| P0-14 | **Refresh reuse-detection containment**: revoke family + emit `reuse-detected` | #18 | S | Turns a silent replay into a contained, observable event |
| P0-15 | **CSRF for cookie mode** (double-submit + Origin/Referer allowlist; refuse `sameSite:'none'` without it) | #12 | M–L | Required before cross-domain dashboard/SPA topologies are safe |
| P0-16 | **Security headers** on admin SPA + SSO callback (`X-Frame-Options`/CSP `frame-ancestors`/nosniff); **pin SSO `postMessage` origin**; stop reflecting raw query params | #14, #20 | M | Do the real code-for-token exchange server-side |
| P0-17 | **Encrypt TOTP secret at rest** + `select:false` | #25 | M | Needs `totpEncryptionKey`; migration for existing seeds |

### P1 — Hardening & consistency

| Item | Findings | Effort |
|------|----------|:------:|
| **Revocable admin sessions** (jti/token-version store) + shorten default lifetime | #19 | M |
| **Admin RBAC + tenant-scope claim** (least-privilege admins) | #26 | L |
| **Session-id rotation on privilege elevation** (call existing `rotateSession`) | #27 | S |
| **Key domain separation** (HKDF subkeys); require explicit `otp.secret`; drop silent fallbacks | #29 | M |
| **`iss`/`aud`/`nbf`** on all tokens | #33 | S |
| **`LIKE`-escape** in `searchPermissions` | #28 | XS |
| **`resetMfa` clears `isMfaEnabled` + revokes sessions**; cap verification OTPs | #32 | S |
| **Ship migrations; `synchronize:false` guidance; unique indexes** on identity | §16 | M–L |

### P2 — Config surface (Section C), opt-in, back-compat defaults

| Item | Effort |
|------|:------:|
| Add `security.*` block (`rateLimit`, `lockout`, `captcha`, `csrf`, `cors`, `headers`, `sso`) with `@nestjs/throttler` + Redis store | L |
| Extend `password.policy.*` (length, blocklist, HIBP breach check) | M |
| Extend `emailAuth.disposable.*` + `emailAuth.canonicalize.*` (+ `canonicalEmail` column & unique index) | M–L |
| Extend `registration.*` (`requireVerifiedEmail`, `enumerationSafe`) | S–M |
| Fix the **deep-merge array-concat footgun** for every new array key (replace-on-set/dedupe) | S |

### P3 — Dashboard productization (Section D), gated on P0/P1 admin fixes

| Item | Effort |
|------|:------:|
| `NestAuthSetting` entity + `SettingsService` (allowlisted keys, version cache, Redis invalidation) | L |
| `GET/PUT /admin/settings` with server-side clamp + **`settings:write` RBAC + step-up** | M–L |
| Code-side **lock/floor/ceiling** model (`settings.locked/floors/ceilings`) | M |
| Settings-change **audit stream** (non-disableable) | S |
| **SPA rebuild**: Settings tab + Disposable-Emails viewer (baseline read-only + override editors) | L (separate app) |

**Sequencing rationale:** P0-1/2/3 (token forgery) and P0-4 (OTP brute force) are the two unauthenticated-ATO roots and are mostly small, self-contained server changes — do them first. The account-linking group (P0-6/7) and admin group (P0-8/9/10) are the next-highest real-world risk. **The dashboard (P3) must not ship before the admin-console revocation, CSRF, and RBAC fixes (P0-8/9/12/15/16, P1 RBAC/revocation)** — otherwise a Settings tab hands a captured admin cookie the ability to rewrite production security policy.