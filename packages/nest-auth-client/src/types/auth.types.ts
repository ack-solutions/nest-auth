/**
 * Core authentication types
 * Client-specific types only
 */

import { ISessionUserData } from "@ackplus/nest-auth-contracts";

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
    tenantId?: string;
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
    user: ISessionUserData | null;
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

/**
 * Observable snapshot of the current token state.
 * Exposed via `authClient.getTokenState()` / `authClient.subscribeTokenState()`.
 *
 * For consumers outside React (web workers, service workers, analytics) that
 * need to react to auth state changes without going through React context.
 */
export interface TokenState {
    /** The current access token, or null if not logged in / in cookie mode. */
    accessToken: string | null;
    /** Current token transport mode. */
    mode: 'header' | 'cookie';
    /** Whether the AuthClient considers the user authenticated. */
    isAuthenticated: boolean;
    /** Token expiry, parsed from JWT `exp` claim. Null if token absent/invalid. */
    expiresAt: Date | null;
    /** User id from JWT `sub`/`userId`/`user_id` claims. Null if no token. */
    userId: string | null;
}
