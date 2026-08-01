# @ackplus/nest-auth

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
