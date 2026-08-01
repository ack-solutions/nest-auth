import { CookieOptions as ExpressCookieOptions } from 'express';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionDataPayload, SessionPayload, JWTTokenPayload } from './token-payload.interface';
import type { SessionStore } from '../../session/interfaces/session-store.interface';

export enum SessionStorageType {
    REDIS = 'redis',
    DATABASE = 'database',
    MEMORY = 'memory',
    /** A consumer-supplied store provided via `session.store`. */
    CUSTOM = 'custom',
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
     * Plug in a custom session store. Provide a ready {@link SessionStore}
     * instance, or a factory returning one (sync or async). When set, it
     * overrides `storageType` and the built-in stores.
     *
     * Implement {@link SessionStore} directly, or extend `BaseSessionRepository`
     * for the shared expiry/helper logic.
     *
     * @example
     * ```ts
     * // an instance you constructed (with its own deps):
     * session: { store: new MyDynamoSessionStore(dynamoClient) }
     *
     * // or a factory for async setup:
     * session: { store: async () => MyKvSessionStore.connect(env.KV_URL) }
     * ```
     */
    store?: SessionStore | (() => SessionStore | Promise<SessionStore>);

    accessTokenValidity?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    refreshTokenValidity?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"

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
        /**
         * JWT secret used for signing and verification. REQUIRED — the library no
         * longer ships an insecure default. Use a high-entropy (32+ byte) random
         * value from an environment variable / secrets manager, e.g.
         * `secret: process.env.JWT_SECRET`. Boot fails if it is missing or set to
         * a known-insecure value.
         */
        secret: string;

        /**
         * Enforce that `secret` is at least 32 characters. Defaults to `false`
         * (a shorter secret only logs a warning) so upgrading doesn't break
         * existing deployments; set `true` to fail closed in production.
         * @default false
         */
        validateSecretStrength?: boolean;

        /**
         * Enable the `'jwt'` login provider, which mints a session from a caller-
         * supplied JWT signed with `secret` (`POST /auth/login { providerName: 'jwt' }`).
         * Defaults to `false` — this is a privileged trust-any-signed-token path and
         * must be turned on deliberately (and paired with a dedicated audience). A
         * weak/leaked `secret` here is a full account-takeover primitive.
         * @default false
         */
        enableLoginProvider?: boolean;

        /**
         * Optional custom access token validation.
         * Called from the auth guard after the session is loaded.
         */
        validateToken?: (payload: JWTTokenPayload, session: SessionPayload) => Promise<boolean>;
    };

    maxSessionsPerUser?: number; // Maximum number of active sessions per user (default: 10)
    slidingExpiration?: boolean; // Whether to extend session on activity (default: false)

    /**
     * Allow one client to be logged into MULTIPLE accounts at once and switch
     * the active one (Gmail/Slack-style account switcher). Default: `false`.
     *
     * The backend is already multi-session (every login mints an independent
     * session; nothing revokes the others), so this flag does NOT change session
     * creation. It is an opt-in capability signal: it is surfaced on
     * `GET <prefix>/client-config` so SDKs/UIs can enable their account
     * switcher only when you intend to support it.
     *
     * Multi-account requires header/bearer token delivery (or native secure
     * storage): in `accessTokenType: 'cookie'` mode a single cookie name can
     * only hold one account's tokens. See the multi-account guide.
     */
    allowMultipleAccounts?: boolean;

    /**
     * How frequently a session row's `lastActive` should be touched while a
     * user is active. Pass an `ms` string (e.g. `'5m'`, `'30s'`) or a number
     * of milliseconds. Lower = more accurate "last seen" but more DB writes.
     *
     * @default '5m'
     */
    touchInterval?: number | string;

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
