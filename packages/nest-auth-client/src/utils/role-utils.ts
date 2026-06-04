/**
 * Role and permission utilities
 */

import { ISessionUserData } from '@ackplus/nest-auth-contracts';

function getUserRoleSet(user: ISessionUserData | null | undefined): Set<string> {
    return new Set(
        user?.roles
            .map(role => role?.name?.trim())
            .filter(Boolean) ?? [],
    );
}
/**
 * Check if user has a specific role
 * 
 * @param user - The user object or null
 * @param role - Role name or array of role names
 * @param matchAll - If true, user must have ALL roles; if false (default), user needs ANY role
 * @returns true if user has the required role(s)
 * 
 * @example
 * ```typescript
 * // Check single role
 * if (hasRole(user, 'admin')) { ... }
 * 
 * // Check any of multiple roles
 * if (hasRole(user, ['admin', 'moderator'])) { ... }
 * 
 * // Check all roles
 * if (hasRole(user, ['admin', 'verified'], true)) { ... }
 * ```
 */

export function hasRole(
    user: ISessionUserData | null | undefined,
    role: string | string[],
    matchAll = false,
): boolean {
    const rolesToCheck = Array.isArray(role) ? role : [role];

    if (rolesToCheck.length === 0) {
        return true;
    }

    const userRoles = getUserRoleSet(user);

    if (userRoles.size === 0) {
        return false;
    }

    return matchAll ? rolesToCheck.every(roleName => userRoles.has(roleName)) : rolesToCheck.some(roleName => userRoles.has(roleName));
}

/**
 * Check if user has a specific permission
 * 
 * @param user - The user object or null
 * @param permission - Permission name or array of permission names
 * @param matchAll - If true, user must have ALL permissions; if false (default), user needs ANY permission
 * @returns true if user has the required permission(s)
 * 
 * @example
 * ```typescript
 * // Check single permission
 * if (hasPermission(user, 'orders.read')) { ... }
 * 
 * // Check any of multiple permissions
 * if (hasPermission(user, ['orders.read', 'orders.write'])) { ... }
 * 
 * // Check all permissions
 * if (hasPermission(user, ['orders.read', 'orders.write'], true)) { ... }
 * ```
 */

export function hasPermission(
    user: ISessionUserData | null | undefined,
    permission: string | string[],
    matchAll = false,
): boolean {
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    if (requiredPermissions.length === 0) {
        return true;
    }

    const userPermissions = new Set(user?.permissions ?? []);

    if (userPermissions.size === 0) {
        return false;
    }

    return matchAll
        ? requiredPermissions.every(permissionName => userPermissions.has(permissionName))
        : requiredPermissions.some(permissionName => userPermissions.has(permissionName));
}

/**
 * Check if user has any of the required roles or permissions
 * 
 * @param user - The user object or null
 * @param requirements - Object with roles and/or permissions to check
 * @returns true if user meets any of the requirements
 * 
 * @example
 * ```typescript
 * if (hasAnyAccess(user, { roles: ['admin'], permissions: ['orders.manage'] })) {
 *   // User is admin OR has orders.manage permission
 * }
 * ```
 */
export function hasAnyAccess(
    user: ISessionUserData | null | undefined,
    requirements?: { roles?: string | string[]; permissions?: string | string[] },
): boolean {
    const requiredRoles = normalizeRequirement(requirements?.roles);
    const requiredPermissions = normalizeRequirement(requirements?.permissions);

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
        return true;
    }

    if (!user) {
        return false;
    }

    return (hasRole(user, requiredRoles, false) || hasPermission(user, requiredPermissions, false));
}

/**
 * Check if user has all of the required roles and permissions
 * 
 * @param user - The user object or null
 * @param requirements - Object with roles and/or permissions to check
 * @returns true if user meets all of the requirements
 * 
 * @example
 * ```typescript
 * if (hasAllAccess(user, { roles: ['admin'], permissions: ['orders.manage'] })) {
 *   // User is admin AND has orders.manage permission
 * }
 * ```
 */
export function hasAllAccess(
    user: ISessionUserData | null | undefined,
    requirements?: { roles?: string | string[]; permissions?: string | string[] },
): boolean {
    const requiredRoles = normalizeRequirement(requirements?.roles);
    const requiredPermissions = normalizeRequirement(requirements?.permissions);

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
        return true;
    }

    if (!user) {
        return false;
    }

    const hasRequiredRoles = requiredRoles.length === 0 || hasRole(user, requiredRoles, true);

    const hasRequiredPermissions = requiredPermissions.length === 0 || hasPermission(user, requiredPermissions, true);

    return hasRequiredRoles && hasRequiredPermissions;
}

/**
 * Normalize a roles/permissions requirement input to a clean string array.
 *
 * Fixes a bug where `{ roles: undefined }` was being coerced to `[undefined]`
 * (length 1) instead of `[]`, breaking the "no requirements = allow" semantics.
 */
function normalizeRequirement(value: string | string[] | undefined | null): string[] {
    if (value == null) return [];
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
    }
    return typeof value === 'string' && value.length > 0 ? [value] : [];
}

