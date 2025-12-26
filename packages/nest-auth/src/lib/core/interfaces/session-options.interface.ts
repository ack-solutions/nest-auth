import { CookieOptions as ExpressCookieOptions } from 'express';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionDataPayload, SessionPayload, JWTTokenPayload } from './token-payload.interface';

export enum SessionStorageType {
    REDIS = 'redis',
    DATABASE = 'database',
    MEMORY = 'memory',
}

export interface SessionOptions {
    storageType: SessionStorageType;
    redisUrl?: string;
    /**
     * Custom session repository implementation.
     * Required when storageType be set to SessionStorageType.CUSTOM
     */
    sessionExpiry?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    refreshTokenExpiry?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    maxSessionsPerUser?: number; // Maximum number of active sessions per user (default: 10)
    slidingExpiration?: boolean; // Whether to extend session on activity (default: true)

    /**
     * Customize the data stored in the session (database).
     * This data is NOT sent to the client and can include sensitive information.
     * Supports async operations for database lookups.
     *
     * @param defaultData - The default session data (user, roles, permissions, isMfaVerified)
     * @param user - The authenticated user entity
     * @returns Custom session data to store (can be a Promise)
     *
     * @example
     * ```typescript
     * customizeSessionData: async (defaultData, user) => ({
     *     ...defaultData,
     *     organizationId: user.metadata?.organizationId,
     *     internalApiKey: await fetchApiKey(user.id), // Async DB lookup
     * })
     * ```
     */
    customizeSessionData?: (
        defaultData: SessionDataPayload,
        user: NestAuthUser
    ) => Promise<SessionDataPayload> | SessionDataPayload;

    /**
     * Customize the JWT token payload sent to the client.
     * Keep this minimal for security - sensitive data should stay in session.
     * Supports async operations for database lookups.
     *
     * @param defaultPayload - The default token payload
     * @param session - The created session (with data from customizeSessionData if configured)
     * @returns Custom token payload (can be a Promise)
     *
     * @example
     * ```typescript
     * customizeTokenPayload: async (defaultPayload, session) => ({
     *     ...defaultPayload,
     *     roles: undefined, // Remove sensitive data from token
     *     orgId: session.data?.organizationId, // Add minimal identifier
     * })
     * ```
     */
    customizeTokenPayload?: (
        defaultPayload: JWTTokenPayload,
        session: SessionPayload
    ) => Promise<JWTTokenPayload> | JWTTokenPayload;

    // ============================================
    // SESSION LIFECYCLE HOOKS
    // ============================================

    /**
     * Called when a new session is created (login/signup)
     */
    onCreated?: (session: SessionPayload, user: any) => Promise<void> | void;

    /**
     * Called when a session is refreshed (token refresh)
     */
    onRefreshed?: (oldSession: SessionPayload, newSession: SessionPayload) => Promise<void> | void;

    /**
     * Called when a session is revoked (logout, admin action, security)
     */
    onRevoked?: (session: SessionPayload, reason: 'logout' | 'expired' | 'admin' | 'security' | 'password_change') => Promise<void> | void;
}


export type CookieOptions = Omit<ExpressCookieOptions, 'maxAge'>
