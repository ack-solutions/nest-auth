/**
 * Tenant Types
 */

import { INestAuthRole } from "./role";
import { INestAuthUser } from "./user";

/**
 * Membership state for a `NestAuthUserAccess` row.
 * Stored as a string column (`status`); not a DB enum type.
 */
export enum NestAuthUserAccessStatusEnum {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

export interface INestAuthTenant {
    id?: string;
    name?: string;
    slug?: string;
    userAccesses?: INestAuthUserAccess[];
    description?: string;
    metadata?: Record<string, any>;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface INestAuthUserAccess {
    id?: string;
    userId?: string;
    tenantId?: string;
    user?: INestAuthUser;
    tenant?: INestAuthTenant;
    roles?: INestAuthRole[];
    isDefault?: boolean;
    status?: NestAuthUserAccessStatusEnum | string;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}
