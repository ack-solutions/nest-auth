/**
 * Named rate-limit buckets applied to the library's sensitive endpoints.
 */
export type RateLimitBucket =
    | 'login'
    | 'signup'
    | 'forgotPassword'
    | 'verifyOtp'
    | 'passwordlessSend'
    | 'mfaVerify'
    | 'adminLogin'
    | 'adminReset';

/**
 * Any bucket `@RateLimit` can name: a built-in {@link RateLimitBucket}, or an
 * app-defined one declared in `security.rateLimit.buckets`. Built-in names keep
 * their autocompletion; an app-defined name must exist in config or boot fails.
 */
export type RateLimitBucketName = RateLimitBucket | (string & {});

export interface RateLimitBucketConfig {
    /** Rolling window length in milliseconds. */
    windowMs: number;
    /** Max requests allowed per key within the window. */
    max: number;
}

export interface RateLimitHit {
    /** Request count in the current window (after this increment). */
    count: number;
    /** Epoch ms when the current window resets. */
    resetAt: number;
}

/**
 * Pluggable counter store. The default is in-memory (per-instance); supply a
 * shared (e.g. Redis-backed) implementation for multi-instance deployments.
 */
export interface IRateLimitStore {
    /**
     * Atomically increment the counter for `key`, starting a fresh `windowMs`
     * window when none is active, and return the new count + reset time.
     */
    increment(key: string, windowMs: number): Promise<RateLimitHit> | RateLimitHit;
}

export interface IRateLimitOptions {
    /** Master switch. @default false */
    enabled?: boolean;
    /**
     * How to key the limit:
     * - `'ip'` — per client IP (needs a correct `trust proxy` setup).
     * - `'identifier'` — per target account (email/phone) from the request body.
     * - `'both'` (default) — enforce BOTH an IP limit and an identifier limit.
     * @default 'both'
     */
    keyBy?: 'ip' | 'identifier' | 'both';
    /** Custom counter store. Defaults to an in-memory (per-instance) store. */
    store?: IRateLimitStore;
    /**
     * Per-bucket window/max. A built-in name is merged over its default; any
     * other name declares an app-defined bucket with its own counter, for use
     * with `@RateLimit('<name>')` on your own routes. An app-defined bucket
     * needs both `windowMs` and `max`.
     *
     * @example
     * ```ts
     * buckets: {
     *   login: { windowMs: 60_000, max: 10 },    // override a built-in
     *   lookup: { windowMs: 60_000, max: 20 },   // app-defined
     * }
     * ```
     */
    buckets?: Partial<Record<RateLimitBucket, Partial<RateLimitBucketConfig>>> &
        Record<string, Partial<RateLimitBucketConfig> | undefined>;
}
