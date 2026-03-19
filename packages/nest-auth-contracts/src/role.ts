/**
 * Role and Permission Types
 */

export interface INestAuthRoleTenant {
    id: string;
    name: string;
    slug: string;
}

export interface INestAuthRole {
    id: string;
    name: string;
    guard: string;
    tenantId?: string;
    tenant?: INestAuthRoleTenant;
    isSystem: boolean;
    isActive: boolean;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthPermission {
    id: string;
    name: string;
    guard: string;
    description?: string;
    category?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateRoleInput {
    name: string;
    guard: string;
    tenantId?: string;
    isSystem?: boolean;
    isActive?: boolean;
    permissions: string[];
}

/** Only name, isActive, and permissions are updatable; guard, tenantId, isSystem are read-only. */
export interface IUpdateRoleInput {
    name?: string;
    isActive?: boolean;
    permissions?: string[];
}

/** Only name, category, and description are updatable; guard is read-only. */
export interface IUpdatePermissionInput {
    name?: string;
    category?: string;
    description?: string;
}

export type IRoleResponse = INestAuthRole;
