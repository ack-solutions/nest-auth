---
id: 018
priority: P2
area: backend
mode: disabled
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: Disabled-tenant mode silently discards tenantId in signup/login
---

> **Fixed.** Added `assertTenantIdAllowed(tenantId)` helper on
> `AuthService` and called it at the top of `signup()` and `login()`
> (skipped on platform-admin login). When `tenant.enabled = false` and
> `tenantId` is provided, the request now fails fast with
> `400 TENANT_NOT_ENABLED`. New error code added to `TENANT_ERROR_CODES`.
> Build verified clean.

## Summary

When `tenant.enabled = false`, the signup and login DTOs still accept a `tenantId` field. The library silently drops it on the floor — no error, no warn-level log. A client that was built against a multi-tenant deployment and was redeployed pointing at a single-tenant deployment will appear to work and silently produce wrong data on the consumer side.

## Where

- `packages/nest-auth/src/lib/auth/services/auth.service.ts:150` — signup path passes `tenantId` to user-service which ignores it in disabled mode.
- `packages/nest-auth/src/lib/user/services/user.service.ts:39` — `getUserByEmail(email, tenantId)` takes the parameter but the disabled-mode `checkRequiredTenant()` returns false and the filter is skipped.
- `packages/nest-auth/src/lib/auth/controllers/auth.controller.ts` — login + signup endpoints accept `tenantId` in the request body unconditionally.

## Impact

- Migration risk: a client that thinks "I sent a tenantId, must be in a tenant context" sees zero pushback when the server is actually single-tenant.
- Debug-time confusion: developers wondering "why isn't my tenantId taking effect" get no log, no error, no signal.

## Fix

Two complementary changes:

1. **Reject `tenantId` in disabled mode at validation time**, returning `400 TENANT_NOT_ENABLED`:
   ```ts
   if (!this.config.tenant?.enabled && payload.tenantId) {
     throw new BadRequestException({
       code: 'TENANT_NOT_ENABLED',
       message: 'tenantId provided but multi-tenancy is disabled on this deployment.',
     });
   }
   ```
   Apply on both signup and login paths.

2. **OR**, if the team prefers a softer landing for clients that include `tenantId` defensively, log a `WARN` once via `DebugLoggerService` and silently drop:
   ```ts
   if (!this.config.tenant?.enabled && payload.tenantId) {
     this.debugLogger.warn('tenant', `Received tenantId on a disabled-tenant deployment, ignoring (caller: ${requestPath})`);
   }
   ```

The strict reject is preferable for new deployments. For existing apps, gate behind a config like `tenant.strictMode = true`.

## Verification

- Send `POST /auth/signup` with `tenantId: 'foo'` to a disabled-tenant server.
  - With strict mode: `400 TENANT_NOT_ENABLED`.
  - Without strict mode: 200, plus a debug log line.

## Related

- #017 (switchTenant should also error in disabled mode).
