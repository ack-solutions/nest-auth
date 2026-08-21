# @ackplus/nest-auth-contracts

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
