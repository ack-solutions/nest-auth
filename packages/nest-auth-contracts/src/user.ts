/**
 * User Types
 * Contains: INestAuthUser, INestAuthRole, INestAuthPermission
 */

export interface INestAuthUser {
    id: string;
    email?: string;
    emailVerifiedAt?: Date;
    phone?: string;
    phoneVerifiedAt?: Date;
    passwordHash?: string;
    isVerified: boolean;
    isActive: boolean;
    metadata?: Record<string, any>;
    tenantId?: string;
    isMfaEnabled: boolean;
    mfaRecoveryCode?: string;
    emailTenant?: string;
    phoneTenant?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthRole {
    id: string;
    name: string;
    guard: string;
    tenantId?: string;
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

// Keeping IUserResponse here (or move to auth.ts? usually responses are with requests in auth.ts, but user might want it here. I'll put it in auth.ts to keep req/res together)
