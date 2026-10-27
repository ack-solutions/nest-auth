# @ackplus/nest-auth

## 2.17.0

### Minor Changes

- Zero database queries on an authenticated request. (Issue #13, problem 1, plus a connection leak found alongside it.)

  **`session.userStateCache` — the guard stops reading the user row**

  The guard enforces three user fields on every authenticated request (`isActive`, `mustChangePassword`, `emailVerifiedAt`), and until now it read them from the database each time — one `SELECT` per API call, for data that almost never changes. That is the cost Redis was supposed to remove, and with the Redis session store it now is: **a warm authenticated request costs no database query at all.** Measured, down from exactly one.

  ```ts
  session: {
    storageType: 'redis',
    redis: { url: process.env.REDIS_URL },
    userStateCache: {
      enabled: true,     // default: true on Redis, false on database/memory
      ttlSeconds: 300,   // default: 300 when shared, 5 when per-process
    },
  }
  ```

  **The defaults follow correctness, not speed**

  A stale `isActive` is an authentication bypass — a deactivated account would keep working until its entry expired — so the default depends on whether an invalidation can actually reach every instance:

  | Session store     | Cache                   | Default |
  | ----------------- | ----------------------- | ------- |
  | Redis             | shared by all instances | **on**  |
  | Database / Memory | per Node process        | **off** |

  With a per-process cache, deactivating an account on instance A would not reach instance B until the TTL elapsed. Opt in with `enabled: true` if that window is acceptable (a single-instance deployment loses nothing).

  **Invalidation on every ORM path**

  `NestAuthUserCacheSubscriber`, a TypeORM entity subscriber on `NestAuthUser`, drops an account's entry on every ORM insert, update or remove. That is the real chokepoint: it covers `UserService` calls **and** a bare `user.save()`, such as the admin console's. A deactivation takes effect on the very next request, on every instance.

  It does **not** cover writes TypeORM cannot see — `repository.update()` and other bulk `UPDATE`s, raw SQL, migrations, or another application writing the same database. Those must invalidate explicitly:

  ```ts
  import { NestAuthCacheService } from "@ackplus/nest-auth";

  await this.dataSource.query(
    'UPDATE nest_auth_users SET "isActive" = false WHERE id = $1',
    [userId],
  );
  await this.nestAuthCache.invalidateUser(userId); // without this: stale until ttlSeconds
  ```

  The TTL is a backstop for that case, not the mechanism.

  **Bug fix: the library leaked a Redis connection on shutdown**

  A connection the library opened was never closed when the Nest application shut down, so each app instance left a socket open that ioredis kept trying to reconnect — visible as `[ioredis] Unhandled error event: ECONNRESET` on teardown, and as connections accumulating in a process that boots more than one app (test runs, workers). `RedisSessionStore` now closes a client it owns. A client you supply via `session.redis.client` is still left alone: your app created it, your app closes it.

  **New**
  - `NestAuthCacheService` (`invalidateUser`, `invalidateUsers`, `enabled`, `distributed`, `ttlSeconds`), exported from the package root.
  - `NestAuthEvents.USER_STATE_INVALIDATED`, payload `{ userId }`, emitted on every invalidation.
  - `AuthStateCache` with `RedisAuthStateCache` and `InProcessAuthStateCache`; the Redis backend reuses the session store's own connection, so there is one pool.
  - `UserStateCacheOptions` on `SessionOptions`.

  **Never cached**

  An account that does not exist (so a deleted user is refused immediately, never from a stale entry), and the session itself — that is always a session-store read, which is why a store outage still fails closed with `503 SESSION_STORE_UNAVAILABLE`.

  **Upgrade note**

  No action for most apps. If you change `isActive`, `mustChangePassword` or `emailVerifiedAt` outside TypeORM while using the Redis store, add a `NestAuthCacheService.invalidateUser(userId)` call. `userStateCache: { enabled: false }` restores the previous read-every-request behaviour exactly.

  **Not included** — issue #13 problems 2, 3 and 5 (cross-instance authz versioning for the per-process `sessionAuthzCache`, API-key read consolidation, and the live-vs-snapshotted consistency table) are unchanged and still to come. Tracked in `.tasks/025-issue-13-per-request-db-reads-and-cross-instance-staleness.md`.

### Patch Changes

- @ackplus/nest-auth-contracts@2.17.0

## 2.16.0

### Minor Changes

- 152ea50: Share your own Redis connection, and fail closed when the session store is down. (Issue #13, problem 4, plus the proving ground for the rest.)

  **Security fix: a Redis outage no longer opens optional-auth routes**

  The guard treated _any_ error during authentication as a failed sign-in. On a route with optional auth that meant a session-store outage was read as "no session": the request was reset to anonymous and served. A route carrying `@NestAuthRoles` or `@NestAuthPermissions` alongside optional auth was therefore open for the duration of a Redis outage.

  Two independent `catch` blocks did this — one in `handleJwtAuth`, one in `canActivate` — so both are fixed. The Redis store now raises a typed `SessionStoreUnavailableError` instead of a plain `Error`, and the guard rethrows it before either optional-auth branch.

  A store outage is now refused on every route:

  |                                | Response                              |
  | ------------------------------ | ------------------------------------- |
  | Required auth                  | `503` `SESSION_STORE_UNAVAILABLE`     |
  | Optional auth, token presented | `503` `SESSION_STORE_UNAVAILABLE`     |
  | Optional auth, no token        | unchanged — normal anonymous response |

  `503` rather than `401` is deliberate: a `401` makes clients sign the user out, so a brief Redis blip would log out every user. `503` means retry. The outage is logged once when it starts and once when it clears, not once per request.

  **New option: `session.redis.client`**

  ```ts
  const redis = new Redis(process.env.REDIS_URL);
  NestAuthModule.forRoot({
    session: {
      storageType: "redis",
      redis: { client: redis, keyPrefix: "auth:" },
    },
  });
  ```

  Reuses your existing ioredis connection instead of opening a second one, so TLS, password, sentinel and cluster are configured once. Other connection fields are ignored when `client` is set; `keyPrefix` and `ttlSeconds` still apply. The library never calls `quit()` on a client it did not create.

  **Bug fix: live objects survived config merging**

  `NestAuthModule.getOptions` deep-merges caller options, which rebuilds a class instance as a plain object and strips its prototype. `session.store` and `customAuthProviders` were already protected; `session.redis.client` now is too. Without it an injected client arrived with every method gone (`this.redis.smembers is not a function`).

  **New**
  - `SessionStoreUnavailableError`, exported from the package root.
  - `SESSION_STORE_UNAVAILABLE` error code, in both the server and `@ackplus/nest-auth-contracts`.

  **Test infrastructure**

  Issue #13's remaining problems cannot be proven on sqljs with an in-process store, so this adds the harness they need: real Postgres and real Redis via Testcontainers, two app instances sharing them, and a SQL counter for asserting how many database round trips a request costs. Suites skip (not silently pass) when Docker is unavailable.

  It records a measured baseline for problem 1: with the Redis store, a warm authenticated request still costs **1 database query** — the guard's `nest_auth_users` read. That is the number the next phase has to drive to zero.

  **Not included** — issue #13 problems 1, 2, 3 and 5 (user-state caching, cross-instance authz versioning, API-key caching, and the live-session consistency table) are unchanged and still to come.

### Patch Changes

- Updated dependencies [152ea50]
  - @ackplus/nest-auth-contracts@2.16.0

## 2.15.0

### Minor Changes

- 2faf2cb: Fixes for issues #8, #9, #10 and #11.
  - **`AuthProvider` no longer shows the previous account after a `client` change (#8).** Switching accounts by swapping the `client` prop now clears `sessionData` and `session` and resets `status` to `'loading'` synchronously, so no render shows the old account's permissions. Late results from the old client (a slow `/auth/me`, a token refresh) are dropped. If the new account can't be verified during an outage, the provider fails closed to `'unknown'` with no permissions instead of keeping the old account's `'authenticated'`.
  - **`IAccountSwitcher` declares `createPendingClient?()` and `discardPendingClient?(client)` (#9),** so the add-account flow type-checks through `useAccountSwitcher().manager` without a cast. Both are optional because `CookieAccountManager` doesn't implement them.
  - **New `adminConsole.allowPlatformUserManagement` (default `true`) (#10).** Set it to `false` to keep platform (super-admin) users out of the bundled console: creating a platform user, granting or revoking platform access and setting platform roles answer `403 PLATFORM_USER_MANAGEMENT_DISABLED`, and existing platform users are read-only there (editing, deleting or removing their MFA device is refused). The console hides those controls; tenant users, sessions and roles stay manageable.
  - **App-defined rate-limit buckets (#11).** `security.rateLimit.buckets` accepts any name (with `windowMs` and `max`), and `@RateLimit` accepts those names, each with its own counter. A `@RateLimit` naming a bucket that is neither built-in nor configured now fails at boot. Previously such a name left the route unthrottled without an error. Built-in bucket overrides may now be partial (for example `{ max: 10 }` keeps the default window).

### Patch Changes

- @ackplus/nest-auth-contracts@2.15.0

## 2.14.1

### Patch Changes

- @ackplus/nest-auth-contracts@2.14.1

## 2.14.0

### Minor Changes

- 1a36145: `session.maxSessionsPerUser` can vary per account, and evictions now fire `onRevoked`.

  **Per-account session cap**

  `maxSessionsPerUser` accepted a single number applied to every account. It now also accepts a resolver, asked once per sign-in:

  ```ts
  session: {
    maxSessionsPerUser: ({ userId, data }) =>
      data.roles?.some((r) => r.name === 'staff') ? 20 : 3,
  },
  ```

  The context carries the account id and the session data about to be stored — including that account's `roles` and `permissions` — so the cap can key off role, tenant or plan. The function may be async.

  A plain number behaves exactly as before. The cap must be a positive whole number; unset, `0`, negative, fractional, `NaN` or a non-number result falls back to the default of `10`. `hasReachedMaxSessions(userId, data?)` takes the same optional context and resolves the cap the same way.

  **Evictions are no longer silent**

  Evicting a session to make room went through a raw store delete, so `session.onRevoked` never fired and apps could not observe it. Eviction now goes through the normal revoke path and fires `onRevoked(session, 'evicted')`. `'evicted'` is a new member of the reason union, exported as `SessionRevokeReason`.

  If your `onRevoked` switches exhaustively on `reason`, add a case for `'evicted'` — it is a widened union, so a `switch` with no `default` will no longer be exhaustive at compile time.

  **Apps can now delete**
  - Any per-role or per-plan session-capping workaround that wrapped `createSession` or swept sessions after the fact.
  - Any eviction bookkeeping that polled the session store because evictions were unobservable.

  New exported types: `MaxSessionsContext`, `MaxSessionsResolver`, `SessionRevokeReason`.

  Also corrects the docs, which claimed `maxSessionsPerUser: 0` disabled the cap. It never did — `0` fell through to the default of `10`, and still does.

### Patch Changes

- @ackplus/nest-auth-contracts@2.14.0

## 2.13.1

### Patch Changes

- @ackplus/nest-auth-contracts@2.13.1

## 2.13.0

### Minor Changes

- feat(access-keys): an off switch, and a session for API-key requests

  Signing in by API key (`Authorization: ApiKey <public>.<private>`) could not be switched off, and a request let through by key had **no session** — so `RequestContext.currentTenantId()` was `null` and an app could not tenant-scope it without a guard of its own.
  - **`accessKeys: { enabled: false }`** turns API-key sign-in off: the guard rejects every `ApiKey` credential with `401 API_KEY_AUTH_DISABLED` (optional-auth routes proceed unauthenticated) and `AccessKeyService.createAccessKey` refuses to mint keys. Default `true`.
  - **Key requests now carry a session for the key's user**, built per request: `RequestContext.currentUserId()` / `currentTenantId()` / `currentUserAccess()` and `request.session.data` work as for a signed-in user. `session.data.authType` is `'api-key'` and `session.data.accessKeyId` names the key. The session is never stored and has no `id`; `logout`, `switch-tenant` and the MFA endpoints treat a key request as having no session. `GET /auth/me` now works with a key (it used to 500).
  - **Tenant:** the key's own `tenantId` when pinned — new optional `createAccessKey(userId, name, { tenantId })`, validated against an active membership (`400 API_KEY_TENANT_MISMATCH`) — otherwise the user's only active membership (always the case in ISOLATED mode). An unpinned key for a user with several memberships has no tenant.

  Two fixes in the same path:
  - **A deactivated user's key no longer authenticates** (`401 ACCOUNT_INACTIVE`). Only the key's own `isActive` flag was checked before.
  - **Role checks for a key no longer count `inactive` memberships.** They used to union roles across every membership the user had, inactive ones included. A scoped key now acts with the roles of its one membership.

  **Migration:** adds one nullable column, `nest_auth_access_keys.tenantId` (varchar). Apps on `synchronize: false` must add it; existing keys keep working unpinned.

  **Behaviour change to check:** a key whose user belongs to exactly one tenant used to reach role checks with that tenant's roles and no tenant context; it now has the tenant context too. A key whose only membership is inactive now passes no role/permission check.

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-contracts@2.13.0

## 2.12.0

### Minor Changes

- feat(guard): a session's roles/permissions are no longer frozen at sign-in

  `createSessionFromUser` copied the caller's roles and permission names into `session.data`, the store persisted that copy for the session's whole life, and `NestAuthAuthGuard` authorized from it. So a permission added to a role, a role granted or revoked, or a membership going `inactive` **never reached anyone already signed in** — for up to the full refresh lifetime. `GET /auth/me` recomputed from the database, which is why it and the guard disagreed.
  - The guard now **re-resolves `session.data.roles` / `.permissions` from the same rows sign-in reads** (tenant access row, or the platform marker for platform sessions), on a small per-instance cache. New option **`authorization.liveSessionRoles`**: `true` (the default, 30s window), `{ ttl }` to tune (`'10s'` or milliseconds; `0` = every request), or `false` to restore the frozen-at-sign-in behavior.
  - A **missing or `inactive` access row resolves to no roles and no permissions** — a member removed from a tenant stops passing role/permission checks instead of keeping the grants their sign-in copy carried. Plain `@Auth()` routes (no role/permission requirement) still authenticate; this revokes grants, not the session.
  - Only `roles`/`permissions` are replaced, in memory, per request. Other session data — including fields from `session.customizeSessionData` — is untouched. Apps that inject **extra** roles/permissions at sign-in via that hook should re-apply them in `guards.afterAuth` (which runs **after** the refresh, so existing afterAuth-based workarounds keep working unchanged) or opt out.
  - A failed read keeps the sign-in copy — the refresh can never turn into a 401.
  - `SessionManagerService.rotateSession` re-resolves before persisting, instead of copying the stale snapshot forward for another session lifetime.

  Minor (not patch) because the **default behavior changes**: authorization now reflects the database within the cache window, and one extra query runs per session per window per instance. Set `authorization.liveSessionRoles: false` for the old behavior.

### Patch Changes

- fix: AuthExceptionFilter keeps structured fields; RateLimitGuard is idempotent per request
  - **`AuthExceptionFilter` no longer strips structured exception fields.** A handler throwing `new UnprocessableEntityException({ message, errors })` (or `problems`, or any structured payload — per-row import errors were the reported case) had its body rebuilt as only `{ statusCode, error, message, code? }`. Extra keys now pass through, while the envelope stays normalized — in particular `message` remains a **single string** (the first entry of a validation array), so clients that parse it are unaffected. Responses that carried no extra keys are byte-identical.
  - **Registering `RateLimitGuard` twice can no longer halve a limit.** `@RateLimit(bucket)` already carries `UseGuards(RateLimitGuard)`; naming the guard again in a controller's own `@UseGuards(...)` made Nest run it twice per request, double-counting every bucket so each limit silently became half of what it said (`signup` max 5 allowed 2, `passwordlessSend` max 3 allowed 1). The guard now stamps the request per bucket and counts once regardless of how many times it is registered. The decorator alone remains the intended usage.
  - @ackplus/nest-auth-contracts@2.12.0

## 2.11.1

### Patch Changes

- ebc87dd: Grant, revoke, and create platform (super-admin) users from the admin console.

  2.11.0 shipped platform user management as roles-only — an existing platform user's roles could be changed, but there was no way to make someone a platform user, so a non-platform user's detail page had nothing actionable on it. Both paths are now supported.

  **Admin API**
  - `PATCH /api/users/:id` accepts `isPlatformUser: true | false` to grant or revoke the `NestAuthPlatformAccess` marker. Granting is idempotent and is applied **before** `platformRoleIds`, so a single request can grant access and set platform roles together. Revoking removes the marker and its platform roles; tenant memberships and tenant roles are untouched.
  - `POST /api/users` accepts `isPlatformUser: true` to provision a tenant-less platform user directly (`tenantId` is ignored, and the ISOLATED-mode tenant requirement does not apply).
  - Both require `platformAccess.enabled` in the module config; otherwise they are refused with `400 PLATFORM_ACCESS_DISABLED`. Assigning `platformRoleIds` to a user with no platform access is still `400 NOT_PLATFORM_USER` — grant it first, or in the same request.

  **Admin console UI**
  - User detail: "Grant access" on a non-platform user; "Revoke" alongside "Manage roles" on a platform user. Both are confirmed before applying.
  - Create User dialog: a "Platform user (super-admin)" option that provisions a tenant-less platform account and skips tenant selection.
  - All of the above appear only when `platformAccess.enabled` is true.

  Note that this is a deliberate privilege-escalation surface: with `platformAccess.enabled`, any admin-console operator can make any user — including themselves — a platform super-admin. Restrict console access accordingly.
  - @ackplus/nest-auth-contracts@2.11.1

## 2.11.0

### Minor Changes

- 4cd5b27: Manage platform (super-admin) users from the admin console.

  Platform access and tenant access are two independent scopes on the same user row, but the admin console dropped `platformAccess` from every response — so a platform user was indistinguishable from a tenant user and had no manage option at all once tenants were enabled.

  **Admin API**
  - `GET /api/users` accepts `?scope=all|platform|tenant` to filter by access scope (composes with `search` / `status` / `tenantId` / `roleName`; `meta.scope` echoes the resolved value).
  - List and detail responses now hydrate both scopes and include `platformAccess` (or `null`) plus an `isPlatformUser` flag.
  - `PATCH /api/users/:id` accepts `platformRoleIds` to set a platform user's platform-wide roles. Roles-only by design: it never creates or removes the platform-access marker, and is refused with `400 NOT_PLATFORM_USER` for a non-platform user — so the console is not a path to minting super-admins. Provisioning stays in `UserService.createPlatformUser`.

  **Admin console UI**
  - Users list: an "Access scope" filter, a "Platform" chip on platform users, and platform roles rendered separately from tenant roles.
  - User detail: a "Platform Access" section showing the marker, its status, and its roles, with a "Manage roles" dialog — displayed alongside the "Tenants" section so both scopes are visible and independently managed. A platform user's tenant-less access row no longer renders as an empty tenant card.

  **Contracts**
  - New `INestAuthPlatformAccess`; `INestAuthUser` gains an optional `platformAccess`.

### Patch Changes

- Updated dependencies [4cd5b27]
  - @ackplus/nest-auth-contracts@2.11.0

## 2.10.4

### Patch Changes

- fix(forRootAsync): providers and options are read live, not captured at construction

  Phone login was dead under `forRootAsync`: `POST /auth/login` with `providerName: 'phone'` returned `INVALID_PROVIDER` / `PROVIDER_NOT_FOUND` even with `phoneAuth: { enabled: true }`. Same class of bug as the 2.8.0 `JwtService` "captured options at construction" issue.

  `AuthProviderRegistryService` lives in `CoreModule` — an **import** of `NestAuthModule` — and does not depend on `NEST_AUTH_ASYNC_OPTIONS_PROVIDER`, so Nest constructs it _before_ the async options factory calls `AuthConfigService.setOptions()`. It read `getOptions()` in its constructor and registered the defaults there (`emailAuth.enabled: true`, `phoneAuth.enabled: false`), so the phone provider was never registered. Every provider repeated the capture (`this.enabled = this.options.x?.enabled`), and `AuthService` captured the whole options object, so the signup path rejected phone as well.
  - `AuthProviderRegistryService` reads options through a lazy getter and registers the built-in providers in **`onModuleInit`** — which Nest runs after every provider (including the async options factory) has been instantiated. The read accessors also register on demand, so a registry used outside Nest's lifecycle still behaves.
  - `BaseAuthProvider.enabled` is now a live getter backed by `resolveEnabled()`, overridden by each built-in provider to read current options. Assigning `enabled` still wins, so custom providers are unaffected.
  - The social/JWT providers (`google`, `facebook`, `github`, `apple`, `jwt`) also captured their **config objects** at construction — all now read live. Under `forRootAsync` they were silently disabled too.
  - `AuthService.authConfig` is a live getter instead of a constructor capture.

  **Also fixed: `forRootAsync` could not boot at all.** `forRoot` sets `global` from the _merged_ options (default `isGlobal: true`), but `forRootAsync` read `isGlobal` off the async wrapper (`useClass`/`useFactory`/`inject`), which is normally `undefined` — so the module came up non-global and `TenantService` could not resolve `DebugLoggerService`, failing app startup with a DI error. It now falls back to the same default. Passing `isGlobal` explicitly still wins.

  No API changes. `forRoot` behaviour is unchanged.
  - @ackplus/nest-auth-contracts@2.10.4

## 2.10.3

### Patch Changes

- change(user-access): membership is gated by `status`, not `isActive`

  `NestAuthUserAccess` membership state is now the `status` column (`active` | `inactive`, via the new `NestAuthUserAccessStatusEnum`); the `isActive` column and `INestAuthUserAccess.isActive` are **removed**. Login, session resolution, `RequestContext.currentUserAccess()`, tenant listing, and the admin tenant-sync all filter and set `status`.

  **⚠️ Run this backfill BEFORE dropping the `isActive` column — otherwise deactivated members silently regain access.**

  Nothing ever wrote `status` in previous versions, so every existing row carries the column default `'active'` — _including_ memberships an admin deactivated (which set only `isActive = false`). Switching the gate to `status` would therefore re-activate every one of them.

  ```sql
  -- backfill first
  UPDATE nest_auth_user_accesses SET status = 'inactive' WHERE "isActive" = false;
  -- then drop the old column (or let synchronize do it)
  ALTER TABLE nest_auth_user_accesses DROP COLUMN "isActive";
  ```

  If you run with `synchronize: true`, take the backfill **before** booting the upgraded app — synchronize drops `isActive` on start, and with it the only record of who was deactivated.

  Other notes:
  - `NestAuthUserAccessStatusEnum` is exported as a runtime value from `@ackplus/nest-auth`, `@ackplus/nest-auth-contracts`, and `@ackplus/nest-auth-client`.
  - The admin user-detail response no longer includes `isActive` on each access entry; read `status` instead.
  - Fixed `UserService.getTenantsByUserIdentity`, which awaited the query builder and then ran `getMany()` twice, discarding the first result set.
  - `UserService.ensureUserAccess` now reactivates an existing `inactive` membership instead of returning it as-is.

- Updated dependencies
  - @ackplus/nest-auth-contracts@2.10.3

## 2.10.2

### Patch Changes

- @ackplus/nest-auth-contracts@2.10.2

## 2.10.1

### Patch Changes

- **Fixed — a fresh visitor / cleared storage got stuck on load instead of the
  login page.** `POST /auth/refresh-token` with **no** refresh token (header
  mode: none in the body; cookie mode: no refresh cookie) returned **400**
  `refreshToken is required`. Since the SDK treats only 401/403 as a definitive
  logout (everything else is indeterminate/retryable, per 2.9.0), the boot
  `verify-session -> refresh` chain read that 400 as "couldn't determine" and the
  app hung on load. "No refresh token" means unauthenticated, so it now returns
  **401** (`REFRESH_TOKEN_INVALID`) — consistent with an _invalid_ refresh token,
  which already 401s. Authenticated flows are unchanged.
  - @ackplus/nest-auth-contracts@2.10.1

## 2.10.0

### Minor Changes

- **MFA recovery codes are now a proper backup authenticator (opt-in flow).**
  - **New `POST /auth/mfa/verify-recovery-code`** — redeem a single-use recovery
    code to **complete the sign-in** (like `mfa/verify`), returning a full
    session. Unlike `reset-totp`, MFA stays enabled and the enrolled factors are
    untouched — the code acts as a backup authenticator (GitHub/Google model).
    The recovery-verified session can enrol a fresh authenticator via `setup-totp`
    **inline**, so a member who lost their device recovers in ONE flow instead of
    two sign-ins and a Settings detour. Emits `MFA_RECOVERY_CODE_USED`.
  - **Multiple recovery codes.** `generate-recovery-code` now issues a **set**
    (default 10, via `mfa.recoveryCodeCount`) stored one hashed row per code in a
    new `nest_auth_mfa_recovery_codes` table, each single-use. The response is
    `{ codes: string[], code }` (`code` = `codes[0]`, kept for back-compat). The
    legacy single-column `mfaRecoveryCode` is still honoured, and `reset-totp`
    consumes from the same store.
  - **New opt-in `mfa.requireVerifiedContactForEnrollment`** (default `false`):
    only allow enrolling a new authenticator when the user has a verified email or
    phone, so an abandoned enrolment can't strand the account.
  - Additive/backward-compatible — no existing endpoint or response shape changed.

  > **Migration:** this adds a `nest_auth_mfa_recovery_codes` table. Apps running
  > `synchronize: false` must add it in a migration (a single table:
  > `id uuid pk`, `userId uuid`, `codeHash varchar`, `usedAt timestamp null`,
  > `createdAt timestamp`). Nothing else changed schema-wise.
  - @ackplus/nest-auth-contracts@2.10.0

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
  with the _pending_ challenge token during the login challenge, it must now
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
