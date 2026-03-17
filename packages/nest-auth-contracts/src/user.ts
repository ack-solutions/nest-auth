/**
 * User Types
 * Contains: INestAuthUser, INestAuthRole, INestAuthPermission
 */

import { INestAuthIdentity, INestAuthOTP, INestAuthSession } from "./auth";
import { INestAuthMFASecret } from "./mfa";
import { INestAuthTenant, INestAuthUserAccess } from "./tenant";

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
    isMfaEnabled: boolean;
    mfaRecoveryCode?: string;
    identities?: INestAuthIdentity[];
    mfaSecrets?: INestAuthMFASecret[];
    sessions?: INestAuthSession[];
    otps?: INestAuthOTP[];
    userAccesses?: INestAuthUserAccess[];
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
