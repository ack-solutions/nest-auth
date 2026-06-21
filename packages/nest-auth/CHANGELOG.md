# @ackplus/nest-auth

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
