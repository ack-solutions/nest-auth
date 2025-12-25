/**
 * Tenant Types
 * Contains: INestAuthTenant
 */

export interface INestAuthTenant {
    id: string;
    name: string;
    slug: string;
    domain?: string; // deprecated
    description?: string;
    metadata?: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
