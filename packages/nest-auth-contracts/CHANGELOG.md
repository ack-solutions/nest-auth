# @ackplus/nest-auth-contracts

## 2.14.0

## 2.13.1

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

## 2.12.0

## 2.11.1

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

## 2.10.4

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

## 2.10.2

## 2.10.1

### Patch Changes

- Lockstep bump for the refresh-token-401 fix (see `@ackplus/nest-auth@2.10.1`).

## 2.10.0

### Minor Changes

- Added `IVerifyRecoveryCodeRequest`, `IGenerateRecoveryCodesResponse`, and
  `IMfaConfig.recoveryCodeCount` / `requireVerifiedContactForEnrollment` for the
  recovery-code-as-backup-authenticator feature (see `@ackplus/nest-auth@2.10.0`).

## 2.8.0

### Minor Changes

- Security-hardening release. New opt-in config types (CSRF, rate limiting, lockout, password policy, disposable-email) and social profile fields (`firstName` / `lastName` / `avatarUrl`); no breaking contract-shape changes.

## 2.7.6

## 2.7.5

### Patch Changes

- feat: add `IClientConfig` and related public client-config types
  (`IPasswordlessAuthConfig`, `IOAuthProviderPublicConfig`,
  `IPlatformAccessPublicConfig`, `IMultipleAccountsConfig`) for the expanded
  `GET /auth/client-config` response.

## 2.7.4

## 2.7.3

## 2.7.2

## 2.7.1

## 2.7.0

## 2.6.0

## 2.5.2
