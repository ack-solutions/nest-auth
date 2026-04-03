/**
 * User Types
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
