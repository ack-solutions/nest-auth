export const serviceReferenceDocs = `
## Injectable Services

This documentation covers the injectable services available in the \`@ackplus/nest-auth\` package. These services can be injected into your controllers, services, or other providers to programmatically manage users, roles, permissions, tenants, sessions, and access keys.

---

## UserService

The \`UserService\` provides methods for managing users programmatically.

### Injection

\`\`\`typescript
import { UserService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private userService: UserService) {}
}
\`\`\`

### createUser()

Create a new user.

**Signature**:
\`\`\`typescript
async createUser(data: Partial<NestAuthUser>): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`data\`: User data
  - \`email?\`: string - User email
  - \`phone?\`: string - User phone
  - \`password?\`: string - Password (will be hashed)
  - \`tenantId?\`: string - Tenant ID (uses default if not provided)
  - \`metadata?\`: object - Custom metadata

**Returns**: Created user object

**Example**:
\`\`\`typescript
const user = await this.userService.createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  metadata: {
    department: 'Engineering'
  }
});

// Set password separately
await user.setPassword('NewPassword123!');
await this.userService.updateUser(user.id, user);
\`\`\`

**Errors**:
- \`BadRequestException\`: If neither email nor phone provided
- \`ConflictException\`: If user already exists

---

### getUserById()

Get user by ID.

**Signature**:
\`\`\`typescript
async getUserById(id: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`id\`: User ID
- \`options?\`: TypeORM find options (relations, select, etc.)

**Returns**: User object or null

**Example**:
\`\`\`typescript
const user = await this.userService.getUserById('user-id');

// With relations
const userWithRoles = await this.userService.getUserById('user-id', {
  relations: ['roles', 'roles.permissions']
});
\`\`\`

---

### getUserByEmail()

Get user by email.

**Signature**:
\`\`\`typescript
async getUserByEmail(
  email: string,
  tenantId?: string,
  options?: FindOneOptions<NestAuthUser>
): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`email\`: User email
- \`tenantId?\`: Tenant ID (uses default if not provided)
- \`options?\`: TypeORM find options

**Returns**: User object or null

**Example**:
\`\`\`typescript
const user = await this.userService.getUserByEmail('user@example.com');
\`\`\`

---

### updateUser()

Update user details.

**Signature**:
\`\`\`typescript
async updateUser(id: string, data: Partial<NestAuthUser>): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`id\`: User ID
- \`data\`: Fields to update

**Returns**: Updated user object

**Example**:
\`\`\`typescript
const updated = await this.userService.updateUser('user-id', {
  email: 'newemail@example.com',
  metadata: { department: 'Sales' }
});
\`\`\`

**Errors**:
- \`NotFoundException\`: If user not found
- \`ConflictException\`: If email/phone already exists

---

### deleteUser()

Delete a user.

**Signature**:
\`\`\`typescript
async deleteUser(id: string): Promise<void>
\`\`\`

**Parameters**:
- \`id\`: User ID

**Example**:
\`\`\`typescript
await this.userService.deleteUser('user-id');
\`\`\`

**Errors**:
- \`NotFoundException\`: If user not found

---

### verifyUser()

Mark user as verified.

**Signature**:
\`\`\`typescript
async verifyUser(
  id: string,
  verificationType?: 'email' | 'phone' | 'none'
): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`id\`: User ID
- \`verificationType?\`: Type of verification

**Returns**: Updated user object

**Example**:
\`\`\`typescript
await this.userService.verifyUser('user-id', 'email');
\`\`\`

---

### updateUserStatus()

Update user active status.

**Signature**:
\`\`\`typescript
async updateUserStatus(id: string, isActive: boolean): Promise<NestAuthUser>
\`\`\`

**Parameters**:
- \`id\`: User ID
- \`isActive\`: Active status

**Example**:
\`\`\`typescript
// Suspend user
await this.userService.updateUserStatus('user-id', false);

// Activate user
await this.userService.updateUserStatus('user-id', true);
\`\`\`

---

### getUsersByRole()

Get users with a specific role.

**Signature**:
\`\`\`typescript
async getUsersByRole(roleName: string, guard: string): Promise<NestAuthUser[]>
\`\`\`

**Parameters**:
- \`roleName\`: Role name
- \`guard\`: Guard name

**Returns**: Array of users

**Example**:
\`\`\`typescript
const admins = await this.userService.getUsersByRole('admin', 'web');
\`\`\`

---

## RoleService

The \`RoleService\` provides methods for managing roles and permissions.

### Injection

\`\`\`typescript
import { RoleService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private roleService: RoleService) {}
}
\`\`\`

### createRole()

Create a new role.

**Signature**:
\`\`\`typescript
async createRole(
  name: string,
  guard: string,
  tenantId?: string | null,
  isSystem?: boolean,
  permissionIds?: string | string[]
): Promise<NestAuthRole>
\`\`\`

**Parameters**:
- \`name\`: Role name
- \`guard\`: Guard name (e.g., 'web', 'api')
- \`tenantId?\`: Tenant ID (null for system roles)
- \`isSystem?\`: Whether role is system-wide
- \`permissionIds?\`: Permission IDs to assign

**Returns**: Created role object

**Example**:
\`\`\`typescript
const role = await this.roleService.createRole(
  'manager',
  'web',
  'tenant-id',
  false,
  ['perm-1', 'perm-2']
);
\`\`\`

**Errors**:
- \`ConflictException\`: If role already exists

---

### getRoleById()

Get role by ID.

**Signature**:
\`\`\`typescript
async getRoleById(
  id: string,
  options?: FindOneOptions<NestAuthRole>
): Promise<NestAuthRole>
\`\`\`

**Parameters**:
- \`id\`: Role ID
- \`options?\`: TypeORM find options

**Returns**: Role object or null

**Example**:
\`\`\`typescript
const role = await this.roleService.getRoleById('role-id', {
  relations: ['permissions']
});
\`\`\`

---

### getRoleByName()

Get role by name.

**Signature**:
\`\`\`typescript
async getRoleByName(
  name: string,
  guard?: string,
  tenantId?: string,
  options?: FindOneOptions<NestAuthRole>
): Promise<NestAuthRole>
\`\`\`

**Parameters**:
- \`name\`: Role name
- \`guard?\`: Guard name
- \`tenantId?\`: Tenant ID
- \`options?\`: TypeORM find options

**Returns**: Role object or null

**Example**:
\`\`\`typescript
const adminRole = await this.roleService.getRoleByName('admin', 'web');
\`\`\`

---

### getRoles()

Get roles with filters.

**Signature**:
\`\`\`typescript
async getRoles(
  params?: {
    guard?: string;
    tenantId?: string;
    onlyTenantRoles?: boolean;
    onlySystemRoles?: boolean;
  },
  options?: FindManyOptions<NestAuthRole>
): Promise<NestAuthRole[]>
\`\`\`

**Parameters**:
- \`params?\`: Filter parameters
- \`options?\`: TypeORM find options

**Returns**: Array of roles

**Example**:
\`\`\`typescript
// Get all system roles
const systemRoles = await this.roleService.getRoles({
  onlySystemRoles: true
});

// Get tenant roles
const tenantRoles = await this.roleService.getRoles({
  tenantId: 'tenant-id',
  onlyTenantRoles: true
});
\`\`\`

---

### updateRole()

Update role details.

**Signature**:
\`\`\`typescript
async updateRole(id: string, data: Partial<NestAuthRole>): Promise<NestAuthRole>
\`\`\`

**Parameters**:
- \`id\`: Role ID
- \`data\`: Fields to update

**Returns**: Updated role object

**Example**:
\`\`\`typescript
const updated = await this.roleService.updateRole('role-id', {
  name: 'new-name',
  description: 'Updated description'
});
\`\`\`

**Errors**:
- \`NotFoundException\`: If role not found
- \`ConflictException\`: If role is system role or name conflicts

---

### updateRolePermissions()

Update role permissions.

**Signature**:
\`\`\`typescript
async updateRolePermissions(
  id: string,
  permissionIds: string | string[]
): Promise<NestAuthRole>
\`\`\`

**Parameters**:
- \`id\`: Role ID
- \`permissionIds\`: Permission IDs to assign

**Returns**: Updated role object

**Example**:
\`\`\`typescript
await this.roleService.updateRolePermissions('role-id', [
  'perm-1',
  'perm-2',
  'perm-3'
]);
\`\`\`

---

### deleteRole()

Delete a role.

**Signature**:
\`\`\`typescript
async deleteRole(id: string): Promise<void>
\`\`\`

**Parameters**:
- \`id\`: Role ID

**Example**:
\`\`\`typescript
await this.roleService.deleteRole('role-id');
\`\`\`

**Errors**:
- \`NotFoundException\`: If role not found
- \`BadRequestException\`: If role is system role

---

## PermissionService

The \`PermissionService\` provides methods for managing permissions.

### Injection

\`\`\`typescript
import { PermissionService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private permissionService: PermissionService) {}
}
\`\`\`

### createPermission()

Create a new permission.

**Signature**:
\`\`\`typescript
async createPermission(data: {
  name: string;
  guard?: string;
  description?: string;
  category?: string;
  metadata?: Record<string, any>;
}): Promise<NestAuthPermission>
\`\`\`

**Parameters**:
- \`data.name\`: Permission name
- \`data.guard?\`: Guard name (default: 'web')
- \`data.description?\`: Description
- \`data.category?\`: Category for grouping
- \`data.metadata?\`: Custom metadata

**Returns**: Created permission object

**Example**:
\`\`\`typescript
const permission = await this.permissionService.createPermission({
  name: 'users.create',
  guard: 'web',
  description: 'Create new users',
  category: 'Users',
  metadata: { module: 'user-management' }
});
\`\`\`

**Errors**:
- \`ConflictException\`: If permission already exists

---

### getPermissions()

Get permissions with filters.

**Signature**:
\`\`\`typescript
async getPermissions(options?: {
  search?: string;
  category?: string;
  guard?: string;
  limit?: number;
}): Promise<NestAuthPermission[]>
\`\`\`

**Parameters**:
- \`options?.search\`: Search term (name or description)
- \`options?.category\`: Category filter
- \`options?.guard\`: Guard filter
- \`options?.limit\`: Limit results

**Returns**: Array of permissions

**Example**:
\`\`\`typescript
// Search permissions
const userPerms = await this.permissionService.getPermissions({
  search: 'user',
  category: 'Users',
  limit: 50
});
\`\`\`

---

### updatePermission()

Update permission details.

**Signature**:
\`\`\`typescript
async updatePermission(id: string, data: {
  name?: string;
  guard?: string;
  description?: string;
  category?: string;
  metadata?: Record<string, any>;
}): Promise<NestAuthPermission>
\`\`\`

**Parameters**:
- \`id\`: Permission ID
- \`data\`: Fields to update

**Returns**: Updated permission object

**Example**:
\`\`\`typescript
await this.permissionService.updatePermission('perm-id', {
  description: 'Updated description',
  category: 'New Category'
});
\`\`\`

---

### deletePermission()

Delete a permission.

**Signature**:
\`\`\`typescript
async deletePermission(id: string): Promise<void>
\`\`\`

**Parameters**:
- \`id\`: Permission ID

**Example**:
\`\`\`typescript
await this.permissionService.deletePermission('perm-id');
\`\`\`

---

### createPermissions()

Batch create permissions (useful for seeding).

**Signature**:
\`\`\`typescript
async createPermissions(permissions: Array<{
  name: string;
  description?: string;
  category?: string;
  metadata?: Record<string, any>;
}>): Promise<NestAuthPermission[]>
\`\`\`

**Parameters**:
- \`permissions\`: Array of permission data

**Returns**: Array of created permissions

**Example**:
\`\`\`typescript
const permissions = await this.permissionService.createPermissions([
  { name: 'users.create', description: 'Create users', category: 'Users' },
  { name: 'users.read', description: 'Read users', category: 'Users' },
  { name: 'users.update', description: 'Update users', category: 'Users' },
  { name: 'users.delete', description: 'Delete users', category: 'Users' }
]);
\`\`\`

---

## TenantService

The \`TenantService\` provides methods for managing tenants in multi-tenant applications.

### Injection

\`\`\`typescript
import { TenantService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private tenantService: TenantService) {}
}
\`\`\`

### createTenant()

Create a new tenant.

**Signature**:
\`\`\`typescript
async createTenant(data: Partial<NestAuthTenant>): Promise<NestAuthTenant>
\`\`\`

**Parameters**:
- \`data.slug\`: Tenant slug (lowercase, letters, numbers, hyphens, underscores)
- \`data.name\`: Tenant name
- \`data.description?\`: Description
- \`data.metadata?\`: Custom metadata
- \`data.isActive?\`: Active status (default: true)

**Returns**: Created tenant object

**Example**:
\`\`\`typescript
const tenant = await this.tenantService.createTenant({
  slug: 'acme-corp',
  name: 'Acme Corporation',
  description: 'Acme Corp Tenant',
  metadata: {
    plan: 'enterprise',
    maxUsers: 1000
  }
});
\`\`\`

**Errors**:
- \`BadRequestException\`: If slug format is invalid
- \`ConflictException\`: If tenant already exists

---

### getTenantById()

Get tenant by ID.

**Signature**:
\`\`\`typescript
async getTenantById(
  id: string,
  options?: FindOneOptions<NestAuthTenant>
): Promise<NestAuthTenant>
\`\`\`

**Parameters**:
- \`id\`: Tenant ID
- \`options?\`: TypeORM find options

**Returns**: Tenant object or null

**Example**:
\`\`\`typescript
const tenant = await this.tenantService.getTenantById('tenant-id');
\`\`\`

---

### getTenantBySlug()

Get tenant by slug.

**Signature**:
\`\`\`typescript
async getTenantBySlug(
  slug: string,
  options?: FindOneOptions<NestAuthTenant>
): Promise<NestAuthTenant>
\`\`\`

**Parameters**:
- \`slug\`: Tenant slug
- \`options?\`: TypeORM find options

**Returns**: Tenant object or null

**Example**:
\`\`\`typescript
const tenant = await this.tenantService.getTenantBySlug('acme-corp');
\`\`\`

---

### updateTenant()

Update tenant details.

**Signature**:
\`\`\`typescript
async updateTenant(
  id: string,
  data: Partial<NestAuthTenant>
): Promise<NestAuthTenant>
\`\`\`

**Parameters**:
- \`id\`: Tenant ID
- \`data\`: Fields to update

**Returns**: Updated tenant object

**Example**:
\`\`\`typescript
await this.tenantService.updateTenant('tenant-id', {
  name: 'New Name',
  isActive: false
});
\`\`\`

---

### deleteTenant()

Delete a tenant.

**Signature**:
\`\`\`typescript
async deleteTenant(id: string): Promise<void>
\`\`\`

**Parameters**:
- \`id\`: Tenant ID

**Example**:
\`\`\`typescript
await this.tenantService.deleteTenant('tenant-id');
\`\`\`

---

### resolveTenantId()

Resolve tenant ID (uses provided or default).

**Signature**:
\`\`\`typescript
async resolveTenantId(providedTenantId?: string | null): Promise<string | null>
\`\`\`

**Parameters**:
- \`providedTenantId?\`: Tenant ID to use

**Returns**: Resolved tenant ID or null

**Example**:
\`\`\`typescript
// Uses default tenant if none provided
const tenantId = await this.tenantService.resolveTenantId();

// Uses provided tenant
const tenantId = await this.tenantService.resolveTenantId('tenant-id');
\`\`\`

---

## SessionManagerService

The \`SessionManagerService\` provides methods for managing user sessions.

### Injection

\`\`\`typescript
import { SessionManagerService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private sessionManager: SessionManagerService) {}
}
\`\`\`

### createSession()

Create a new session.

**Signature**:
\`\`\`typescript
async createSession(payload: {
  userId: string;
  refreshToken?: string;
  data?: any;
  userAgent?: string;
  deviceName?: string;
  ipAddress?: string;
}): Promise<NestAuthSession>
\`\`\`

**Parameters**:
- \`payload.userId\`: User ID
- \`payload.refreshToken?\`: Refresh token
- \`payload.data?\`: Custom session data
- \`payload.userAgent?\`: User agent string
- \`payload.deviceName?\`: Device name
- \`payload.ipAddress?\`: IP address

**Returns**: Created session object

**Example**:
\`\`\`typescript
const session = await this.sessionManager.createSession({
  userId: 'user-id',
  data: {
    loginMethod: 'email',
    isMfaVerified: true
  },
  deviceName: 'Chrome - Windows',
  ipAddress: '192.168.1.1'
});
\`\`\`

---

### getUserSessions()

Get all sessions for a user.

**Signature**:
\`\`\`typescript
async getUserSessions(userId: string): Promise<NestAuthSession[]>
\`\`\`

**Parameters**:
- \`userId\`: User ID

**Returns**: Array of sessions

**Example**:
\`\`\`typescript
const sessions = await this.sessionManager.getUserSessions('user-id');
console.log(\`User has \${sessions.length} active sessions\`);
\`\`\`

---

### revokeSession()

Revoke (delete) a session.

**Signature**:
\`\`\`typescript
async revokeSession(sessionId: string): Promise<void>
\`\`\`

**Parameters**:
- \`sessionId\`: Session ID

**Example**:
\`\`\`typescript
await this.sessionManager.revokeSession('session-id');
\`\`\`

---

### revokeAllUserSessions()

Revoke all sessions for a user.

**Signature**:
\`\`\`typescript
async revokeAllUserSessions(userId: string): Promise<void>
\`\`\`

**Parameters**:
- \`userId\`: User ID

**Example**:
\`\`\`typescript
// Force logout from all devices
await this.sessionManager.revokeAllUserSessions('user-id');
\`\`\`

---

### validateSession()

Validate a session and return it if valid.

**Signature**:
\`\`\`typescript
async validateSession(sessionId: string): Promise<NestAuthSession | null>
\`\`\`

**Parameters**:
- \`sessionId\`: Session ID

**Returns**: Session object or null if invalid/expired

**Example**:
\`\`\`typescript
const session = await this.sessionManager.validateSession('session-id');
if (session) {
  console.log('Session is valid');
} else {
  console.log('Session is invalid or expired');
}
\`\`\`

---

## AccessKeyService

The \`AccessKeyService\` provides methods for managing API access keys for users.

### Injection

\`\`\`typescript
import { AccessKeyService } from '@ackplus/nest-auth';

@Injectable()
export class MyService {
  constructor(private accessKeyService: AccessKeyService) {}
}
\`\`\`

### createAccessKey()

Create a new access key for a user.

**Signature**:
\`\`\`typescript
async createAccessKey(userId: string, name: string): Promise<NestAuthAccessKey>
\`\`\`

**Parameters**:
- \`userId\`: User ID
- \`name\`: Access key name/description

**Returns**: Created access key object (includes \`publicKey\` and \`privateKey\`)

**Example**:
\`\`\`typescript
const accessKey = await this.accessKeyService.createAccessKey(
  'user-id',
  'Production API Key'
);

// Return these to the user (they won't be able to see privateKey again)
console.log('Public Key:', accessKey.publicKey);
console.log('Private Key:', accessKey.privateKey);
\`\`\`

**Errors**:
- \`NotFoundException\`: If user not found

---

### validateAccessKey()

Validate an access key.

**Signature**:
\`\`\`typescript
async validateAccessKey(publicKey: string, privateKey: string): Promise<boolean>
\`\`\`

**Parameters**:
- \`publicKey\`: Public key
- \`privateKey\`: Private key

**Returns**: \`true\` if valid, \`false\` otherwise

**Example**:
\`\`\`typescript
const isValid = await this.accessKeyService.validateAccessKey(
  'public-key-here',
  'private-key-here'
);

if (isValid) {
  // Proceed with API request
}
\`\`\`

---

### getUserAccessKeys()

Get all access keys for a user.

**Signature**:
\`\`\`typescript
async getUserAccessKeys(userId: string): Promise<NestAuthAccessKey[]>
\`\`\`

**Parameters**:
- \`userId\`: User ID

**Returns**: Array of access keys

**Example**:
\`\`\`typescript
const keys = await this.accessKeyService.getUserAccessKeys('user-id');
console.log(\`User has \${keys.length} access keys\`);
\`\`\`

---

### deactivateAccessKey()

Deactivate an access key (soft delete).

**Signature**:
\`\`\`typescript
async deactivateAccessKey(publicKey: string): Promise<NestAuthAccessKey>
\`\`\`

**Parameters**:
- \`publicKey\`: Public key

**Returns**: Updated access key object

**Example**:
\`\`\`typescript
await this.accessKeyService.deactivateAccessKey('public-key-here');
\`\`\`

---

### deleteAccessKey()

Delete an access key permanently.

**Signature**:
\`\`\`typescript
async deleteAccessKey(publicKey: string): Promise<void>
\`\`\`

**Parameters**:
- \`publicKey\`: Public key

**Example**:
\`\`\`typescript
await this.accessKeyService.deleteAccessKey('public-key-here');
\`\`\`

---

## Complete Usage Example

Here's a complete example showing how to use multiple services together:

\`\`\`typescript
import { Injectable } from '@nestjs/common';
import {
  UserService,
  RoleService,
  PermissionService,
  TenantService
} from '@ackplus/nest-auth';

@Injectable()
export class OnboardingService {
  constructor(
    private userService: UserService,
    private roleService: RoleService,
    private permissionService: PermissionService,
    private tenantService: TenantService
  ) {}

  async onboardNewOrganization(data: {
    tenantName: string;
    tenantSlug: string;
    adminEmail: string;
    adminPassword: string;
  }) {
    // 1. Create tenant
    const tenant = await this.tenantService.createTenant({
      slug: data.tenantSlug,
      name: data.tenantName,
      isActive: true
    });

    // 2. Create permissions
    const permissions = await this.permissionService.createPermissions([
      { name: 'users.manage', category: 'Users' },
      { name: 'settings.manage', category: 'Settings' },
      { name: 'billing.view', category: 'Billing' }
    ]);

    // 3. Create admin role with permissions
    const adminRole = await this.roleService.createRole(
      'admin',
      'web',
      tenant.id,
      false,
      permissions.map(p => p.id)
    );

    // 4. Create admin user
    const adminUser = await this.userService.createUser({
      email: data.adminEmail,
      tenantId: tenant.id,
      isVerified: true
    });

    await adminUser.setPassword(data.adminPassword);
    await this.userService.updateUser(adminUser.id, adminUser);

    // 5. Assign admin role to user
    await adminUser.assignRole(adminRole.id);

    return {
      tenant,
      adminUser,
      adminRole
    };
  }
}
\`\`\`
`;
