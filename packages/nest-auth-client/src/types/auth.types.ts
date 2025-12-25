/**
 * Core authentication types
 */

/**
 * Authenticated user information
 */
export interface AuthUser {
    /** User unique identifier */
    id: string;
    /** User email address */
    email?: string;
    /** User phone number */
    phone?: string;
    /** Email verification status */
    isVerified: boolean;
    /** Whether user account is active */
    isActive?: boolean;
    /** Additional user metadata */
    metadata?: Record<string, any>;
    /** User roles */
    roles?: string[];
    /** User permissions */
    permissions?: string[];
    /** Tenant ID for multi-tenant applications */
    tenantId?: string;
    /** Whether MFA is enabled */
    isMfaEnabled?: boolean;
}

/**
 * Authentication session information
 */
export interface AuthSession {
    /** Session unique identifier */
    sessionId?: string;
    /** Associated user ID */
    userId: string;
    /** Access token (if header mode) */
    accessToken?: string;
    /** Refresh token (if header mode) */
    refreshToken?: string;
    /** Token expiration time */
    expiresAt?: Date;
    /** Device information */
    deviceName?: string;
    /** User agent string */
    userAgent?: string;
}

/**
 * Authentication status
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Authentication state
 */
export interface AuthState {
    status: AuthStatus;
    user: AuthUser | null;
    session: AuthSession | null;
    error: AuthError | null;
}

/**
 * Authentication error
 */
export interface AuthError {
    /** Error message */
    message: string;
    /** Error code */
    code?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Additional error details */
    details?: Record<string, any>;
}

/**
 * Token pair returned from auth endpoints
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

/**
 * Decoded JWT payload (non-verified)
 */
export interface DecodedJwt {
    /** Subject (usually user ID) */
    sub?: string;
    /** Expiration time (Unix timestamp) */
    exp?: number;
    /** Issued at time (Unix timestamp) */
    iat?: number;
    /** User ID */
    userId?: string;
    /** Tenant ID */
    tenantId?: string;
    /** Session ID */
    sessionId?: string;
    /** Token type */
    type?: 'access' | 'refresh';
    /** Any additional claims */
    [key: string]: any;
}
