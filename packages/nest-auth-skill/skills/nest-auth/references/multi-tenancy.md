# Multi-tenancy

Off by default. It fits products where users, roles and data are separated per organization or workspace. For a lighter need (a company name on a profile, simple teams) an ordinary column in the app may be enough; say so, and enable tenancy if the user wants it.

## Choose the mode first

| | `SHARED` | `ISOLATED` |
|---|---|---|
| A person is | one account that can join many tenants | a separate account in each tenant |
| Same email in two tenants | same user, two memberships | two unrelated users, two passwords |
| Login needs a tenant | no (pick or switch after login) | yes, `tenantId` on login and signup |
| Switch tenant without re-login | yes, `switchTenant` | no |
| Typical product | Slack/Notion-style workspaces | white-label / per-customer portals |

If the request does not make the mode clear, ask: switching later means migrating users. Nest Auth separates identities, memberships and roles per tenant in one database. Filtering the app's own tables by tenant is done in the app (below); if the project wants a database or schema per tenant, that is the app's data layer and can sit alongside Nest Auth.

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

`RequestContext.currentTenantId()` reads the tenant from the signed-in session, so it cannot be spoofed by the caller. Apply the filter however the project prefers: in each service, a base repository, a TypeORM subscriber, or a request-scoped helper.

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

In ISOLATED mode also pass `tenantId` to `signup`, `passwordlessSend`, `passwordlessLogin` and `verifyForgotPasswordOtp`.

Ways to find the tenant before login (ISOLATED): a subdomain per tenant, a slug field on the login form, a path segment, or an email-first step where your own endpoint calls `UserService.getTenantsByEmail(email)` and lets the user pick.

## Roles per tenant

A membership (`NestAuthUserAccess`) holds the user's roles for that tenant. Assign with `users.setUserAccessRoles(userId, tenantId, roleIds)`. See `roles-permissions.md`.

## Making an existing app multi-tenant

1. Confirm the mode with the user.
2. Enable the option; create a tenant for the existing data; add a membership for each existing user (`ensureUserAccess`).
3. Add `tenantId` to the app's tables with a migration and backfill it.
4. Scope queries. Then add the tenant picker / switcher UI.

Do steps 2–3 as a migration script and tell the user to back up first.
