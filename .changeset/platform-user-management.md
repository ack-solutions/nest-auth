---
'@ackplus/nest-auth-contracts': minor
'@ackplus/nest-auth': minor
---

Manage platform (super-admin) users from the admin console.

Platform access and tenant access are two independent scopes on the same user row, but the admin console dropped `platformAccess` from every response — so a platform user was indistinguishable from a tenant user and had no manage option at all once tenants were enabled.

**Admin API**

- `GET /api/users` accepts `?scope=all|platform|tenant` to filter by access scope (composes with `search` / `status` / `tenantId` / `roleName`; `meta.scope` echoes the resolved value).
- List and detail responses now hydrate both scopes and include `platformAccess` (or `null`) plus an `isPlatformUser` flag.
- `PATCH /api/users/:id` accepts `platformRoleIds` to set a platform user's platform-wide roles. Roles-only by design: it never creates or removes the platform-access marker, and is refused with `400 NOT_PLATFORM_USER` for a non-platform user — so the console is not a path to minting super-admins. Provisioning stays in `UserService.createPlatformUser`.

**Admin console UI**

- Users list: an "Access scope" filter, a "Platform" chip on platform users, and platform roles rendered separately from tenant roles.
- User detail: a "Platform Access" section showing the marker, its status, and its roles, with a "Manage roles" dialog — displayed alongside the "Tenants" section so both scopes are visible and independently managed. A platform user's tenant-less access row no longer renders as an empty tenant card.

**Contracts**

- New `INestAuthPlatformAccess`; `INestAuthUser` gains an optional `platformAccess`.
