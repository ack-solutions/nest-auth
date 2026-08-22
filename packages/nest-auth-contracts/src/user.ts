/**
 * User Types
 */

import { INestAuthIdentity, INestAuthOTP, INestAuthSession } from "./auth";
import { INestAuthMFASecret } from "./mfa";
import { INestAuthRole } from "./role";
import { INestAuthTenant, INestAuthUserAccess } from "./tenant";

export interface INestAuthUser {
    id: string;
    email?: string;
    emailVerifiedAt?: Date;
    phone?: string;
    phoneVerifiedAt?: Date;
    passwordHash?: string;
    isActive: boolean;
    metadata?: Record<string, any>;
    isMfaEnabled: boolean;
    mfaRecoveryCode?: string;
    identities?: INestAuthIdentity[];
    mfaSecrets?: INestAuthMFASecret[];
    sessions?: INestAuthSession[];
    otps?: INestAuthOTP[];
    userAccesses?: INestAuthUserAccess[];
    /**
     * Platform (super-admin) access marker. Present only on platform users, and
     * only when the caller asked for the relation. See {@link INestAuthPlatformAccess}.
     */
    platformAccess?: INestAuthPlatformAccess;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Platform (super-admin) access — a tenant-less 1:1 row on a user that carries
 * platform-wide roles. Its *presence* is what makes a user a "platform user"
 * (the same marker the login path enforces); a tenant-less `userAccess` alone
 * does not. Platform roles live here, separate from the per-tenant
 * `userAccesses[].roles`.
 */
export interface INestAuthPlatformAccess {
    id?: string;
    userId?: string;
    user?: INestAuthUser;
    /** Platform-wide roles (global roles — those with no `tenantId`). */
    roles?: INestAuthRole[];
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
