# Multi-tenancy

Off by default. Do not enable it for "users have a company field" or simple team features; enable it when users, roles and data must be separated per organization/workspace.

## Choose the mode first

| | `SHARED` | `ISOLATED` |
|---|---|---|
| A person is | one account that can join many tenants | a separate account in each tenant |
| Same email in two tenants | same user, two memberships | two unrelated users, two passwords |
| Login needs a tenant | no (pick or switch after login) | yes, `tenantId` on login and signup |
| Switch tenant without re-login | yes, `switchTenant` | no |
| Typical product | Slack/Notion-style workspaces | white-label / per-customer portals |

If the request does not make the mode clear, ask. It cannot be changed later without migrating users. Nest Auth isolates identities and roles in one database; it does not switch databases per tenant, and it does not filter the app's own tables.

## Backend

```ts
import { TenantModeEnum } from '@ackplus/nest-auth';
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const tenancy: Partial<IAuthModuleOptions> = {
  tenant: { enabled: true, mode: TenantModeEnum.SHARED },
};
```

Create tenants and memberships with the services:

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, TenantService, UserService } from '@ackplus/nest-auth';

@Injectable()
export class WorkspaceService {
  constructor(private readonly tenants: TenantService, private readonly users: UserService) {}

  async createWorkspace(name: string, slug: string) {
    const tenant = await this.tenants.createTenant({ name, slug }); // slug: lowercase, a-z 0-9 - _
    const userId = RequestContext.currentUserId();
    if (userId) await this.users.ensureUserAccess(userId, tenant.id); // SHARED: add the creator
    return tenant;
  }

  listMine(userId: string) {
    return this.users.getUserTenants(userId);
  }
}
```

### Scope the app's data

Every tenant-owned table needs a `tenantId` column, and every query must filter on the caller's tenant:

```ts
import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '@ackplus/nest-auth';

export function requireTenantId(): string {
  const tenantId = RequestContext.currentTenantId();
  if (!tenantId) throw new ForbiddenException('No active tenant');
  return tenantId;
}
```

Use `RequestContext.currentTenantId()` (it reads the session). Never trust a tenant id from the request body or query for authorization.

## Client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

// SHARED: log in, then choose or switch the active tenant.
export async function switchWorkspace(auth: AuthClient, tenantId: string) {
  await auth.switchTenant({ tenantId }); // new tokens scoped to that tenant
}

// ISOLATED: resolve the tenant first, then pass it to login/signup.
export async function isolatedLogin(auth: AuthClient, baseUrl: string, slug: string, email: string, password: string) {
  const res = await fetch(`${baseUrl}/auth/tenants/lookup?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Unknown workspace');
  const tenant: { id: string } = await res.json();
  return auth.login({ providerName: 'email', credentials: { email, password }, tenantId: tenant.id });
}
```

In ISOLATED mode also pass `tenantId` to `signup`, `passwordlessSend`, `passwordlessLogin` and `verifyForgotPasswordOtp`. A common pattern is one subdomain per tenant: read the slug from the host and look it up once.

## Roles per tenant

A membership (`NestAuthUserAccess`) holds the user's roles for that tenant. Assign with `users.setUserAccessRoles(userId, tenantId, roleIds)`. See `roles-permissions.md`.

## Making an existing app multi-tenant

1. Confirm the mode with the user.
2. Enable the option; create a tenant for the existing data; add a membership for each existing user (`ensureUserAccess`).
3. Add `tenantId` to the app's tables with a migration and backfill it.
4. Scope queries. Then add the tenant picker / switcher UI.

Do steps 2–3 as a migration script and tell the user to back up first.
