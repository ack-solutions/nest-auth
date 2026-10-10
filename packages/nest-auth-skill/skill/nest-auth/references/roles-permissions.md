# Roles and permissions

A user has roles; a role has permissions (plain strings such as `orders.read`). Roles belong to a **guard** namespace; the default guard is `web` and most apps never need another.

## Protect backend routes

```ts
import { Controller, Delete, Get } from '@nestjs/common';
import { Auth, NestAuthPermissions, NestAuthRoles } from '@ackplus/nest-auth';

@Controller('orders')
@Auth()
export class OrdersController {
  @Get()
  @NestAuthPermissions(['orders.read'])            // any one of the list
  list() { return []; }

  @Delete()
  @NestAuthPermissions(['orders.delete', 'orders.manage'], true) // true = all required
  removeAll() { return { ok: true }; }

  @Get('report')
  @NestAuthRoles(['admin', 'manager'])              // any one of these roles
  report() { return {}; }
}
```

Missing role/permission → 403. Prefer permissions on routes and group them into roles; check role names directly only for coarse gates.

## Create roles and assign them

Seed at startup or in a migration script. Permissions must exist before a role can reference them.

```ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PermissionService, RoleService, UserService } from '@ackplus/nest-auth';

@Injectable()
export class RbacSeeder implements OnApplicationBootstrap {
  constructor(
    private readonly permissions: PermissionService,
    private readonly roles: RoleService,
    private readonly users: UserService,
  ) {}

  async onApplicationBootstrap() {
    for (const name of ['orders.read', 'orders.delete']) {
      if (!(await this.permissions.getPermissionByName(name))) {
        await this.permissions.createPermission({ name });
      }
    }
    if (!(await this.roles.getRoleByName('manager'))) {
      // (name, guard, tenantId, isSystem, permissionNames)
      await this.roles.createRole('manager', null, null, true, ['orders.read', 'orders.delete']);
    }
  }

  /** Give a user a role. Pass the tenant id in multi-tenant apps, '' otherwise. */
  async grant(userId: string, roleName: string, tenantId = '') {
    const role = await this.roles.getRoleByName(roleName);
    if (!role) throw new Error(`Unknown role: ${roleName}`);
    await this.users.setUserAccessRoles(userId, tenantId, [role.id]); // replaces the user's roles
  }
}
```

- `isSystem: true` makes a role global; `false` with a `tenantId` makes it belong to one tenant.
- Default role for new users: assign it in a `REGISTERED` event listener (see `advanced.md`).
- The admin console can also manage roles, permissions and assignments.

## Frontend

The session user carries `roles` and `permissions`. UI checks are for display only; the backend decorators are the enforcement.

```tsx
import { RequirePermission, RequireRole, useHasPermission } from '@ackplus/nest-auth-react';

export function OrdersToolbar() {
  const canDelete = useHasPermission('orders.delete');
  return (
    <div>
      <RequireRole role={['admin', 'manager']} fallback={null}>
        <a href="/orders/report">Report</a>
      </RequireRole>
      <RequirePermission permission="orders.read" fallback={<p>No access</p>}>
        <button disabled={!canDelete}>Delete all</button>
      </RequirePermission>
    </div>
  );
}
```

Without React: `hasRole(user, 'admin')` / `hasPermission(user, 'orders.read')` from `@ackplus/nest-auth-client`.

## Notes

- Changes to roles or a role's permissions reach signed-in users within 30s; no re-login needed.
- Several guard namespaces (e.g. separate `admin` and `web` roles): list them in `roleGuards: ['web', 'admin']`, pass the guard to `createRole`, and to `NestAuthRoles(roles, 'admin')`. Only when the request needs separate role sets.
- Cross-tenant super-admins use `platformAccess`, not a tenant role. See `advanced.md`.
