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
    /** Per-bucket window/max overrides (merged over the built-in defaults). */
    buckets?: Partial<Record<RateLimitBucket, RateLimitBucketConfig>>;
}
