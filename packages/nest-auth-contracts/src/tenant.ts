/**
 * Tenant Types
 */

import { INestAuthRole, INestAuthUser } from "./user";

export interface INestAuthTenant {
    id: string;
    name: string;
    slug: string;
    userAccesses?: INestAuthUserAccess[];
    description?: string;
    metadata?: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthUserAccess {
    id: string;
    userId: string;
    tenantId: string;
    user?: INestAuthUser;
    tenant?: INestAuthTenant;
    roles?: INestAuthRole[];
    isActive: boolean;
    isDefault?: boolean;
    status?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}