/**
 * Role and permission utilities
 */

import { AuthUser } from '../types';

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
    user: AuthUser | null | undefined,
    role: string | string[],
    matchAll: boolean = false
): boolean {
    if (!user || !user.roles || user.roles.length === 0) {
        return false;
    }

    const roles = Array.isArray(role) ? role : [role];

    if (matchAll) {
        return roles.every(r => user.roles!.includes(r));
    }

    return roles.some(r => user.roles!.includes(r));
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
    user: AuthUser | null | undefined,
    permission: string | string[],
    matchAll: boolean = false
): boolean {
    if (!user || !user.permissions || user.permissions.length === 0) {
        return false;
    }

    const permissions = Array.isArray(permission) ? permission : [permission];

    if (matchAll) {
        return permissions.every(p => user.permissions!.includes(p));
    }

    return permissions.some(p => user.permissions!.includes(p));
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
    user: AuthUser | null | undefined,
    requirements: { roles?: string[]; permissions?: string[] }
): boolean {
    if (!user) return false;

    const hasRequiredRole = requirements.roles && requirements.roles.length > 0
        ? hasRole(user, requirements.roles)
        : false;

    const hasRequiredPermission = requirements.permissions && requirements.permissions.length > 0
        ? hasPermission(user, requirements.permissions)
        : false;

    return hasRequiredRole || hasRequiredPermission;
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
    user: AuthUser | null | undefined,
    requirements: { roles?: string[]; permissions?: string[] }
): boolean {
    if (!user) return false;

    const hasRequiredRoles = requirements.roles && requirements.roles.length > 0
        ? hasRole(user, requirements.roles, true)
        : true;

    const hasRequiredPermissions = requirements.permissions && requirements.permissions.length > 0
        ? hasPermission(user, requirements.permissions, true)
        : true;

    return hasRequiredRoles && hasRequiredPermissions;
}
