/**
 * The cache behind {@link NestAuthCacheService}.
 *
 * Deliberately tiny: get / set / delete of a JSON value with a TTL. Two
 * implementations ship — one on the session store's Redis connection (shared
 * across every API instance) and one in-process (single instance only).
 */
export interface AuthStateCache {
    /** Shared across instances? False for the in-process cache. */
    readonly distributed: boolean;

    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
}

/**
 * Redis-backed cache, reusing the session store's connection so there is one
 * pool and one configuration. Shared by every API instance, which is what
 * makes an invalidation on instance A visible to instance B.
 *
 * Read failures are swallowed and reported as a miss: a cache that cannot be
 * read must degrade to a database read, never to a failed request. Writes are
 * best-effort for the same reason.
 *
 * This is NOT the session lookup — a session-store outage still fails closed
 * (see SessionStoreUnavailableError). A missing CACHE entry only costs a
 * database query.
 */
export class RedisAuthStateCache implements AuthStateCache {
    readonly distributed = true;

    constructor(
        private readonly redis: any,
        private readonly keyPrefix: string = 'nest-auth:',
    ) { }

    private k(key: string): string {
        return `${this.keyPrefix}${key}`;
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const raw = await this.redis.get(this.k(key));
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            // Treat an unreadable cache as a miss — the caller falls back to
            // the database rather than failing the request.
            return null;
        }
    }

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        try {
            await this.redis.set(this.k(key), JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
        } catch {
            /* best effort: losing a cache write only costs a later DB read */
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redis.del(this.k(key));
        } catch {
            /* see above */
        }
    }
}

/**
 * In-process cache. Used when sessions live in the database or in memory.
 *
 * IMPORTANT: it is per process, so an invalidation on one API instance does
 * NOT reach the others — each expires its own copy after the TTL. That is why
 * the default TTL is short, and why the Redis store is the configuration this
 * is actually tuned for.
 */
export class InProcessAuthStateCache implements AuthStateCache {
    readonly distributed = false;

    private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

    /** Bound the map so a large user base cannot grow it without limit. */
    constructor(private readonly maxEntries = 10_000) { }

    async get<T>(key: string): Promise<T | null> {
        const hit = this.entries.get(key);
        if (!hit) return null;
        if (hit.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return null;
        }
        return hit.value as T;
    }

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        if (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
        }
        this.entries.delete(key); // re-insert at the tail (LRU-ish)
        this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    async del(key: string): Promise<void> {
        this.entries.delete(key);
    }
}
