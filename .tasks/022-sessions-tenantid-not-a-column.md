---
id: 022
priority: P2
area: backend
mode: shared
status: open
package: '@ackplus/nest-auth'
title: nest_auth_sessions.tenantId lives inside the JSON `data` column, not as a structured column
---

## Summary

The session entity stores tenant context in the `data` JSON blob (`session.data.tenantId`). There's no top-level `tenantId` column. Consequence: querying "which sessions does Alice have on tenant Acme?" requires JSON path operators that vary per dialect. The `SessionManagerService.findByUser(userId)` API has no `tenantId` parameter at all.

## Where

- `packages/nest-auth/src/lib/session/entities/session.entity.ts:15-54` — `data: jsonb` is where `tenantId` lives.
- `packages/nest-auth/src/lib/session/services/session-manager.service.ts` — `findByUser`, `revokeAllForUser` etc. don't accept `tenantId`.

## Impact

- "Sign me out of all my tenant-Acme sessions, but keep my tenant-Stark session active" — impossible without JSON traversal.
- "List the devices I'm signed in on for the current tenant" UIs aren't expressible.
- Cross-tenant session enumeration is the default for `findByUser`, which leaks tenant membership detail to operators if the `data` blob is reflected in admin UIs.

## Fix

1. **Add a top-level `tenantId` column** to `NestAuthSession`:
   ```ts
   @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
   @Index()
   tenantId?: string;
   ```
2. **Migration** — populate from `data.tenantId` on existing rows.
3. **Add `tenantId?` parameter** to the session-store methods:
   ```ts
   findByUser(userId: string, tenantId?: string): Promise<NestAuthSession[]>
   revokeAllForUser(userId: string, options?: { tenantId?: string; reason?: string }): Promise<number>
   ```
4. **Keep `data.tenantId`** for backwards compatibility for one minor; deprecate.

## Verification

- Query `SELECT * FROM nest_auth_sessions WHERE user_id = $1 AND tenant_id = $2` works in plain SQL.
- New API: `sessions.findByUser(userId, tenantId)` returns only that tenant's sessions.
- Admin console "active devices" page can scope to current tenant.

## Related

- #008 — session revocation reason is also under-modelled.
