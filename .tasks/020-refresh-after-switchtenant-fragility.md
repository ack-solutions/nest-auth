---
id: 020
priority: P1
area: backend
mode: shared
status: open
package: '@ackplus/nest-auth'
title: Refresh after switchTenant relies on session.data persistence — silent regression risk
---

## Summary

`AuthService.switchTenant` updates the session row's `data.tenantId` and re-issues tokens. `AuthService.refreshToken` then reads the tenant context from `session.data?.tenantId` to build the next token. As long as the row write in `switchTenant` is durable before the refresh fires, this works — but there's no test, and a future change to session storage (e.g. caching, Redis vs DB swap) could silently bounce users back to the previous tenant.

Worse: there's no validation in `refreshToken` that the user still has `userAccess` for `session.data.tenantId`. If an admin removes a user from a tenant after they've switched into it, their existing session keeps refreshing into the (now revoked) tenant until the access token expires.

## Where

- `packages/nest-auth/src/lib/auth/services/auth.service.ts:673-681` — `switchTenant` writes `session.data.tenantId`.
- `packages/nest-auth/src/lib/auth/services/auth.service.ts:854,886-893,902-909` — `refreshToken` reads it back.

## Impact

- A future refactor (e.g. moving session writes to be async/eventual) could cause users to silently drop out of the tenant they just switched to, with no error to indicate why.
- Revoked tenant memberships persist in the JWT until the access-token expiry — typically 1h. For a fast-revocation requirement (security event, contractor offboarding), this window is too long.

## Fix

1. **Re-validate `userAccess` on every refresh.** Before re-signing the token, confirm `session.data.tenantId` is still in the user's accessible tenants:
   ```ts
   if (session.data.tenantId) {
     const access = await this.userAccess.findByUser(session.userId, session.data.tenantId);
     const platform = await this.platformAccess.findByUser(session.userId);
     if (!access && !platform) {
       await this.sessionManager.revoke(session.id, 'tenant_access_revoked');
       throw new UnauthorizedException({ code: 'TENANT_ACCESS_REVOKED' });
     }
   }
   ```

2. **Make `switchTenant` write durable before issuing tokens.** If the current implementation has any "fire-and-forget" persistence of `session.data`, make it `await`ed. (Verify the current code path; the audit suspected fragility but didn't pinpoint a concrete bug.)

3. **Test it.** Add an integration test that:
   - Logs Alice into tenant A
   - `switchTenant` to tenant B
   - Refreshes
   - Asserts the new access token has `tenantId: 'B'`
   - Removes Alice's `userAccess` for B
   - Refreshes again
   - Asserts `401 TENANT_ACCESS_REVOKED`

## Verification

The test above. Plus a stress test that issues 1000 concurrent refreshes after a switchTenant, asserting all 1000 get the new tenant in the response.

## Related

- #017 — same call needs the membership check before swap.
- #013 — no test scaffold yet to write the integration test against.
