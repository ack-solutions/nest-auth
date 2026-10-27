import { CookieOptions as ExpressCookieOptions } from 'express';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionDataPayload, SessionPayload, JWTTokenPayload } from './token-payload.interface';
import type { SessionStore } from '../../session/interfaces/session-store.interface';

/**
 * Context handed to a {@link MaxSessionsResolver} when the per-account session
 * cap is being resolved for a specific sign-in.
 */
export interface MaxSessionsContext {
    /** The account the session is being created for. */
    userId: string;
    /**
     * The session data about to be stored. Carries the account's `roles` and
     * `permissions`, so a resolver can vary the cap by role, tenant or plan.
     *
     * When resolved from `hasReachedMaxSessions(userId)` with no data supplied,
     * this is an empty object — a resolver should tolerate missing fields.
     */
    data: SessionDataPayload;
}

/**
 * Resolves the maximum number of concurrent sessions allowed for one account.
 * Returning anything that is not a positive whole number falls back to the
 * default of 10.
 */
export type MaxSessionsResolver = (
    context: MaxSessionsContext,
) => number | Promise<number>;

/**
 * Why a session ended. `'evicted'` is emitted when a new sign-in pushes the
 * account past `maxSessionsPerUser` and the least-recently-active sessions are
 * dropped to make room.
 */
export type SessionRevokeReason =
    | 'logout'
    | 'expired'
    | 'admin'
    | 'security'
    | 'password_change'
    | 'evicted';

export enum SessionStorageType {
    REDIS = 'redis',
    DATABASE = 'database',
    MEMORY = 'memory',
    /** A consumer-supplied store provided via `session.store`. */
    CUSTOM = 'custom',
}

export interface RedisSessionOptions {
    /**
     * An existing ioredis client (or cluster) to reuse.
     *
     * When set, the library uses this connection instead of opening its own,
     * so one app can share a single pool and one configuration — TLS,
     * password, sentinel, cluster — rather than configuring Redis twice. All
     * other connection fields here (`url`, `host`, `password`, …) are ignored;
     * `keyPrefix` and `ttlSeconds` still apply.
     *
     * Lifecycle stays with the app: the library never calls `quit()` on a
     * client it did not create.
     *
     * @example
     * const redis = new Redis(process.env.REDIS_URL);
     * NestAuthModule.forRoot({
     *   session: { storageType: 'redis', redis: { client: redis } },
     * });
     */
    client?: any;

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

/**
 * Caching of the small amount of user state the auth guard reads on every
 * request (`isActive`, `mustChangePassword`, `emailVerifiedAt`).
 *
 * Without it, every authenticated request costs one database query for data
 * that almost never changes. With it, a warm request costs none.
 *
 * Writes made through TypeORM invalidate the entry automatically. Writes the
 * ORM cannot see — raw SQL, a QueryBuilder bulk `UPDATE`, a migration, another
 * app sharing the database — must call `NestAuthCacheService.invalidateUser()`,
 * or stay stale until `ttlSeconds` elapses.
 */
export interface UserStateCacheOptions {
    /**
     * Turn user-state caching on or off.
     *
     * Defaults to ON with the Redis session store, where the cache is shared
     * and an invalidation on one instance is seen by all of them.
     *
     * Defaults to OFF with the database or memory session store, because the
     * cache is then per process: deactivating an account on instance A would
     * not be seen by instance B until the TTL expired. Set `true` to accept
     * that window in exchange for the saved query.
     */
    enabled?: boolean;

    /**
     * How long a cached entry may live, in seconds.
     *
     * Defaults to 300 when the cache is shared (Redis) — invalidation is
     * immediate there, so the TTL is only a backstop for writes that bypass
     * the ORM. Defaults to 5 for the per-process cache, where the TTL is the
     * only bound on cross-instance staleness.
     */
    ttlSeconds?: number;
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
     * Caching of the user state the auth guard reads on every request, so a
     * warm authenticated request costs no database query. See
     * {@link UserStateCacheOptions} for the defaults and the staleness rules.
     *
     * @example
     * ```ts
     * session: {
     *   storageType: 'redis',
     *   redis: { url: process.env.REDIS_URL },
     *   userStateCache: { enabled: true, ttlSeconds: 120 },
     * }
     * ```
     */
    userStateCache?: UserStateCacheOptions;

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
     * Behaviour when a REPLAYED refresh token is detected (an already-rotated
     * token presented again — a strong signal of token theft, since only a
     * validly-signed token for that session can reach this check).
     */
    refreshTokenReuse?: {
        /**
         * Revoke the WHOLE session on reuse (the OAuth 2.0 best-practice: you
         * can't tell attacker from victim, so kill the token family — this ejects
         * a thief at the cost of the legitimate user re-authenticating). Set
         * `false` to only reject the replayed request without revoking.
         * Either way a `refresh_token_reuse_detected` event is emitted.
         * @default true
         */
        revokeSession?: boolean;
    };

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

    /**
     * Maximum number of concurrent sessions per account (default: 10). Creating
     * a session beyond the cap evicts the least-recently-active ones, each of
     * which fires `onRevoked` with reason `'evicted'`.
     *
     * Pass a function to vary the cap per account — it receives the account id
     * and the session data about to be stored (including roles and
     * permissions). A result that is not a positive whole number falls back to
     * the default.
     *
     * @example
     * // One number for everyone (as before)
     * maxSessionsPerUser: 5
     *
     * @example
     * // Staff get more devices than customers
     * maxSessionsPerUser: ({ data }) =>
     *     data.roles?.some((r) => r.name === 'staff') ? 20 : 3
     */
    maxSessionsPerUser?: number | MaxSessionsResolver;
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
    onRevoked?: (session: SessionPayload, reason: SessionRevokeReason) => Promise<void> | void;
}


export type CookieOptions = Omit<ExpressCookieOptions, 'maxAge'>
