---
id: 019
priority: P0
area: backend
mode: isolated
status: open
package: '@ackplus/nest-auth'
title: ISOLATED tenant mode is currently a no-op — code does not honour the contract
---

## Summary

The docs and the `TenantModeEnum` advertise two modes:

- **SHARED** — single database, every tenant-scoped row carries `tenantId`.
- **ISOLATED** — per-tenant database (or schema) with hard isolation.

The actual implementation of `IsolatedTenantContextService` is a 5-line empty subclass of `BaseTenantContextService`. It does **not** select a different `DataSource` per tenant, it does **not** create per-tenant schemas, and it does **not** prevent cross-tenant queries any more than SHARED mode does. ISOLATED behaves identically to SHARED at runtime.

## Where

`packages/nest-auth/src/lib/tenant/tenant-context/services/isolated-tenant-context.service.ts`:

```ts
@Injectable()
export class IsolatedTenantContextService extends BaseTenantContextService {
    constructor(tenantService: TenantService) {
        super(tenantService);
    }
}
```

(Five lines, zero overrides.)

For comparison, `BaseTenantContextService` and `SharedTenantContextService` (if it exists separately) hold the actual filtering logic.

## Impact

This is a **contract-breaking** divergence. Customers who read [`/docs/concepts/multi-tenancy`](apps/docs/content/docs/concepts/multi-tenancy.mdx) and pick ISOLATED mode for compliance reasons (HIPAA, GDPR-strict, "we need physical separation") get the SHARED-mode runtime — same DB, same connection pool, just `tenantId` filtering. If a query forgets to filter by `tenantId`, tenant A reads tenant B's data. The mode selection gives a false sense of security.

## Fix — pick a path

There's no neutral fix. Either:

### Option A — Update the docs to reflect reality

If real per-DB isolation is out of scope, change [`/docs/concepts/multi-tenancy`](apps/docs/content/docs/concepts/multi-tenancy.mdx) so that ISOLATED is described as **logical row-level isolation with stricter enforcement**, not physical separation. Then:

- Add row-level enforcement in ISOLATED mode that *fails closed* — every query that doesn't have `tenantId` in its `where` clause throws (e.g. wrap repositories with a custom `EntityManager` that asserts).
- Add a `crossTenantQuery: 'reject' | 'log' | 'allow'` config option for the platform-access path.

### Option B — Implement actual per-tenant data sources

Bigger lift. Probably involves:

- A `TenantDataSourceRegistry` that holds one `DataSource` per active tenant.
- Connection-string resolution per tenant (from `nest_auth_tenants.metadata.connectionString` or a callback).
- Lazy initialization + connection pooling discipline.
- A `Repository<T>` resolver that picks the right DataSource based on `request.tenantId`.
- Migration story: when a tenant is created, also provision its schema/database.

This is a multi-week effort and probably needs RFC-level design.

### Recommendation

Ship **Option A** in the next minor (rename "ISOLATED" to "STRICT" if you want signage that it's not physical, or keep the name and expand the docs). Open a separate larger issue for Option B as a v3 milestone.

## Verification

After Option A:

- The [`/docs/concepts/multi-tenancy`](apps/docs/content/docs/concepts/multi-tenancy.mdx) page no longer claims "per-tenant database".
- Setting `mode: ISOLATED` and accidentally writing a query without `tenantId` filter throws at runtime.
- A test demonstrates that tenant A cannot read tenant B's `Order` rows in ISOLATED mode even with a deliberate filter omission.

## Related

- #017 — switchTenant should reject in ISOLATED mode regardless of which path we pick.
- The [`multi-tenancy.mdx`](apps/docs/content/docs/concepts/multi-tenancy.mdx) page in the docs that I wrote (with the per-DB diagram) is currently misleading. Once this issue is fixed one way or the other, that page needs an update.
