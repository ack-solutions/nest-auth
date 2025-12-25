/**
 * Core authentication types
 * Client-specific types only
 */

/**
 * Authentication status
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Client-side session with additional token storage (for header mode)
 */
export interface ClientSession {
    id: string;
    userId: string;
    expiresAt?: Date;
    createdAt?: Date;
    accessToken?: string;
    refreshToken?: string;
}

/**
 * Complete auth state
 */
export interface AuthState {
    status: AuthStatus;
    user: import('@libs/auth-types').IAuthUser | null;
    session: ClientSession | null;
    error: AuthError | null;
}

/**
 * Authentication error
 */
export interface AuthError {
    message: string;
    code?: string;
    statusCode?: number;
    details?: Record<string, any>;
}

/**
 * Decoded JWT payload (non-verified)
 */
export interface DecodedJwt {
    userId?: string;
    sub?: string;
    user_id?: string;
    exp?: number;
    iat?: number;
    sessionId?: string;
    tenantId?: string;
    type?: string;
    [key: string]: any;
}
