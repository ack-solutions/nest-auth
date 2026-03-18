import { NestAuthRole } from '../entities/role.entity';

export function getRolePermissionNames(
    role: Pick<NestAuthRole, 'rolePermissions'> | null | undefined,
): string[] {
    const permissions = new Set<string>();

    for (const rolePermission of role?.rolePermissions ?? []) {
        const name = rolePermission?.permission?.name?.trim();
        if (name) {
            permissions.add(name);
        }
    }

    return Array.from(permissions).sort((a, b) => a.localeCompare(b));
}

export function mapRoleToResponse(
    role: NestAuthRole & { tenant?: { id: string; name: string; slug: string } },
) {
    return {
        id: role.id,
        name: role.name,
        guard: role.guard,
        isSystem: role.isSystem,
        isActive: role.isActive,
        tenantId: role.tenantId,
        tenant: role.tenant ? { id: role.tenant.id, name: role.tenant.name, slug: role.tenant.slug } : undefined,
        permissions: getRolePermissionNames(role),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
    };
}

export function mapRoleToSessionSnapshot(role: NestAuthRole): Partial<NestAuthRole> {
    return {
        id: role.id,
        name: role.name,
        guard: role.guard,
        tenantId: role.tenantId,
        isSystem: role.isSystem,
    };
}
