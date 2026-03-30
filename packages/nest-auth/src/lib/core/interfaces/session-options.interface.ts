import { CookieOptions as ExpressCookieOptions } from 'express';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionDataPayload, SessionPayload, JWTTokenPayload } from './token-payload.interface';

export enum SessionStorageType {
    REDIS = 'redis',
    DATABASE = 'database',
    MEMORY = 'memory',
}

export interface RedisSessionOptions {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    tls?: Record<string, any>;
    keyPrefix?: string;
    ttlSeconds?: number;
    enableOfflineQueue?: boolean;
    retryStrategy?: (times: number) => number | null;
    reconnectOnError?: (error: Error) => boolean | number;
    maxRetriesPerRequest?: number | null;
}

export interface SessionOptions {
    /**
     * Preferred config for store selection.
     * Defaults to database when not provided.
     */
    storageType?: SessionStorageType;

    /**
     * Legacy Redis URL config (backward compatibility).
     */
    redisUrl?: string;

    /**
     * Redis connection and store options.
     */
    redis?: RedisSessionOptions;
    /**
     * Custom session repository implementation.
     * Required when storageType be set to SessionStorageType.CUSTOM
     */
    sessionExpiry?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    refreshTokenExpiry?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"

    /**
     * Cookie options for access/refresh tokens when using `accessTokenType: 'cookie'`.
     * Placed under `session` so all token/session settings live together.
     */
    cookieOptions?: CookieOptions;

    /**
     * Token delivery method for access/refresh tokens.
     * - `header`: tokens are returned in response body (client sends `Authorization`)
     * - `cookie`: tokens are written to HTTP-only cookies
     * - `null/undefined`: check both (header first)
     */
    accessTokenType?: 'header' | 'cookie' | null;

    /**
     * JWT configuration used to sign/verify tokens.
     * Placed under `session` so all TTL/session-related security config lives together.
     */
    jwt?: {
        /** JWT Secret used for signing and verification */
        secret: string;

        /**
         * Optional custom access token validation.
         * Called from the auth guard after the session is loaded.
         */
        validateToken?: (payload: JWTTokenPayload, session: SessionPayload) => Promise<boolean>;
    };

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
