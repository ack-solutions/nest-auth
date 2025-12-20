import { NestAuthRole } from '../../role/entities/role.entity';
import { NestAuthUser } from '../../user/entities/user.entity';

export interface JWTTokenPayload {
    id?: string;
    sub?: string; // user id
    email?: string;
    phone?: string;
    isVerified?: boolean;
    roles?: Partial<NestAuthRole>[];
    tenantId?: string;
    isMfaEnabled?: boolean;
    isMfaVerified?: boolean;
    sessionId?: string;
    type?: 'access' | 'refresh';
    exp?: number;
    iat?: number;
}

/**
 * Data stored in the session (database-side).
 * This data is NOT sent to the client and can include sensitive information.
 */
export interface SessionDataPayload {
    user: NestAuthUser;
    isMfaVerified: boolean;
    isMfaEnabled?: boolean;
    roles: Partial<NestAuthRole>[];
    permissions: string[];
    /** Allow custom fields to be added */
    [key: string]: any;
}

export interface SessionPayload {
    id?: string;
    userId?: string;
    refreshToken?: string;
    userAgent?: string;
    ipAddress?: string;
    deviceName?: string;
    data?: SessionDataPayload;
    expiresAt?: Date;
    lastActive: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TokenGenerationResponse {
    accessToken: string;
    refreshToken: string;
    user?: NestAuthUser;
}
