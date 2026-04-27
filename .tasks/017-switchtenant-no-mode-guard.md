---
id: 017
priority: P1
area: backend
mode: cross-mode
status: open
package: '@ackplus/nest-auth'
title: POST /auth/switch-tenant has no guard for tenant mode — accepts calls in any configuration
---

## Summary

`POST /auth/switch-tenant` is registered unconditionally on `AuthController`. There is no check for `tenant.enabled` or `tenant.mode`. Calling it in three problematic situations:

1. **Tenants disabled** — endpoint returns "tenant switched successfully" but does nothing. The caller is misled into thinking the switch worked.
2. **ISOLATED mode** — the contract is that a user's identity is per-tenant; switching is semantically meaningless. The endpoint should reject the call.
3. **SHARED mode** — works correctly only here, but doesn't validate the calling user actually has `userAccess` for the target tenant before swapping the session.

## Where

- `packages/nest-auth/src/lib/auth/controllers/auth.controller.ts:227-240` — controller handler with no mode/access guards.
- `packages/nest-auth/src/lib/auth/services/auth.service.ts` — `switchTenant(tenantId)` implementation should be the single point of validation.

## Impact

- Clients on disabled-tenant deployments hit the endpoint and get a fake-success response, silently desyncing their UI.
- Clients on ISOLATED-mode deployments can technically call `switchTenant` and may end up in a broken state where the session's `tenantId` no longer matches their identity record (since in ISOLATED mode the user is a different row per tenant).
- A user without `userAccess` for the target tenant could potentially get a session bound to a tenant they don't belong to (depends on the service implementation — verify in fix).

## Fix

In `AuthService.switchTenant`:

1. **Guard tenant mode**:
   ```ts
   if (!this.config.tenant?.enabled) {
     throw new BadRequestException({
       code: 'TENANT_SWITCHING_DISABLED',
       message: 'Multi-tenancy is disabled on this deployment.',
     });
   }
   if (this.config.tenant.mode === TenantModeEnum.ISOLATED) {
     throw new BadRequestException({
       code: 'TENANT_SWITCHING_NOT_SUPPORTED',
       message: 'Tenant switching is not supported in isolated mode. Sign in to the target tenant directly.',
     });
   }
   ```

2. **Verify membership before swapping the session**:
   ```ts
   const access = await this.userAccess.findByUser(currentUser.id, targetTenantId);
   const platform = await this.platformAccess.findByUser(currentUser.id);
   if (!access && !platform) {
     throw new ForbiddenException({
       code: 'NOT_A_MEMBER_OF_TENANT',
       message: 'You do not have access to that tenant.',
     });
   }
   ```

3. **Re-resolve roles and re-run `getSessionUserData`** so the new JWT carries the new-tenant context. (Verify the existing implementation does this; the audit found it relies on session.data persistence which is fragile — see #020.)

## Verification

- E2E test: in disabled mode, `POST /auth/switch-tenant` with a valid body returns `400 TENANT_SWITCHING_DISABLED`.
- E2E test: in ISOLATED mode, returns `400 TENANT_SWITCHING_NOT_SUPPORTED`.
- E2E test (SHARED mode): user without `userAccess` for target gets `403 NOT_A_MEMBER_OF_TENANT`.
- E2E test (SHARED mode): user with `userAccess` gets a fresh JWT carrying the new `tenantId` and the roles for that tenant.

## Related

- #020 — refresh-after-switchTenant fragility.
- #021 — ISOLATED mode is currently a no-op subclass of SHARED.
