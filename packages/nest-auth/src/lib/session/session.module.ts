import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthSession } from './entities/session.entity';
import { SessionManagerService, SESSION_REPOSITORY, SESSION_STORE } from './services/session-manager.service';
import { TypeORMSessionRepository } from './repositories/typeorm-session.repository';
import { MemorySessionRepository } from './repositories/memory-session.repository';
import { DatabaseSessionStore } from './stores/database-session.store';
import { RedisSessionStore, RedisSessionStoreOptions } from './repositories/redis-session.repository';
import { CoreModule } from '../core/core.module';
import { SessionOptions, SessionStorageType, RedisSessionOptions } from '../core/interfaces/session-options.interface';
import { AuthConfigService } from '../core/services/auth-config.service';
import { AUTH_STATE_CACHE, NestAuthCacheService } from '../core/services/nest-auth-cache.service';
import {
    InProcessAuthStateCache,
    RedisAuthStateCache,
    type AuthStateCache,
} from '../core/services/auth-state-cache';
import ms from 'ms';

/**
 * Session Module
 *
 * DEFAULT: Uses TypeORM (Database) for session storage
 * OPTIONAL: Can use Redis if configured (requires ioredis packages)
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthSession]),
        forwardRef(() => CoreModule),
    ],
    providers: [
        // Repository implementations
        TypeORMSessionRepository,
        MemorySessionRepository,
        DatabaseSessionStore,

        // Session Store Provider (dynamically chooses storage)
        {
            provide: SESSION_STORE,
            useFactory: async (databaseStore: DatabaseSessionStore, memoryStore: MemorySessionRepository) => {
                const config = AuthConfigService.getOptions();

                // A consumer-supplied store overrides storageType and the built-ins.
                const customStore = config.session?.store;
                if (customStore) {
                    return typeof customStore === 'function' ? await customStore() : customStore;
                }

                const storageType = SessionModule.resolveStorageType(config.session);

                // Handle Redis storage
                if (storageType === SessionStorageType.REDIS) {
                    return SessionModule.createRedisStore(config.session);
                }

                if (storageType === SessionStorageType.MEMORY) {
                    return memoryStore;
                }

                // Default to database storage
                return databaseStore;
            },
            inject: [DatabaseSessionStore, MemorySessionRepository],
        },
        {
            provide: SESSION_REPOSITORY,
            useExisting: SESSION_STORE,
        },

        // Backend for the auth-state cache. Reuses the session store's Redis
        // connection when there is one, so the library holds ONE pool and one
        // configuration; otherwise falls back to a per-process cache.
        {
            provide: AUTH_STATE_CACHE,
            useFactory: (store: any): AuthStateCache => SessionModule.createAuthStateCache(store),
            inject: [SESSION_STORE],
        },
        NestAuthCacheService,

        // Session Manager
        SessionManagerService,
    ],
    exports: [
        SESSION_STORE,
        SESSION_REPOSITORY,
        AUTH_STATE_CACHE,
        NestAuthCacheService,
        SessionManagerService,
        TypeORMSessionRepository,
        MemorySessionRepository,
        DatabaseSessionStore,
    ],
})
export class SessionModule {
    /**
     * Create Redis store instance
     * Only called if Redis storage is configured
     */
    private static createRedisStore(session?: SessionOptions): any {
        let RedisClient: any;
        let redisClient: any;

        // Try to load Redis modules
        try {
            const redisOptions = SessionModule.resolveRedisOptions(session);

            let ownsClient = false;

            if (redisOptions.client) {
                // The app supplied its own connection. Do NOT require ioredis
                // ourselves and do NOT own this client's lifecycle — the app
                // created it and the app closes it.
                redisClient = redisOptions.client;
            } else {
                // We open it, so we must also close it on shutdown.
                ownsClient = true;
                RedisClient = require('ioredis').default || require('ioredis');
                const clientOptions = SessionModule.buildRedisClientOptions(redisOptions);

                redisClient = redisOptions.url
                    ? new RedisClient(redisOptions.url, clientOptions)
                    : new RedisClient(clientOptions);
            }

            const storeOptions: RedisSessionStoreOptions = {
                keyPrefix: redisOptions.keyPrefix,
                ttlSeconds: redisOptions.ttlSeconds ?? SessionModule.resolveDefaultTtlSeconds(session),
                ownsClient,
            };

            return new RedisSessionStore(redisClient, storeOptions);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('Cannot find module')) {
                throw new Error(
                    'Redis session store selected but redis client dependency not installed. ' +
                    'Install: npm install ioredis'
                );
            }

            throw new Error(
                `Failed to initialize Redis session storage: ${errorMessage}\n` +
                '   Make sure Redis server is running and accessible.'
            );
        }
    }

    /**
     * Pick the backend for the auth-state cache.
     *
     * Prefers the session store's own Redis connection — one pool, one
     * configuration, and an invalidation that every API instance sees. Any
     * other store (database, memory, or a consumer-supplied one) gets the
     * per-process cache, which is why user-state caching is opt-in there.
     */
    private static createAuthStateCache(store: any): AuthStateCache {
        const client = typeof store?.getClient === 'function' ? store.getClient() : undefined;

        // Duck-type the client rather than trusting the method name: a
        // consumer-supplied store may expose an unrelated getClient().
        const usable =
            client &&
            typeof client.get === 'function' &&
            typeof client.set === 'function' &&
            typeof client.del === 'function';

        if (!usable) {
            return new InProcessAuthStateCache();
        }

        const config = AuthConfigService.getOptions();
        const base = SessionModule.resolveRedisOptions(config.session).keyPrefix || 'nest-auth:';
        const prefix = base.endsWith(':') ? base : `${base}:`;
        return new RedisAuthStateCache(client, `${prefix}cache:`);
    }

    private static resolveStorageType(session?: SessionOptions): SessionStorageType {
        const store = session?.storageType ?? SessionStorageType.DATABASE;
        const normalized = String(store).toLowerCase();

        if (normalized === SessionStorageType.REDIS) {
            return SessionStorageType.REDIS;
        }
        if (normalized === SessionStorageType.MEMORY) {
            return SessionStorageType.MEMORY;
        }
        return SessionStorageType.DATABASE;
    }

    private static resolveRedisOptions(session?: SessionOptions): RedisSessionOptions {
        const redis: RedisSessionOptions = {
            ...(session?.redis || {}),
        };

        if (!redis.url && session?.redisUrl) {
            redis.url = session.redisUrl;
        }

        return redis;
    }

    private static resolveDefaultTtlSeconds(session?: SessionOptions): number {
        const expiry = session?.accessTokenValidity;
        if (typeof expiry === 'string') {
            const msValue = ms(expiry);
            if (typeof msValue === 'number' && msValue > 0) {
                return Math.floor(msValue / 1000);
            }
        }

        if (typeof expiry === 'number' && expiry > 0) {
            return Math.floor(expiry);
        }

        return 7 * 24 * 60 * 60;
    }

    private static buildRedisClientOptions(redis: RedisSessionOptions): Record<string, any> {
        const options: Record<string, any> = {
            enableOfflineQueue: redis.enableOfflineQueue ?? true,
            maxRetriesPerRequest: redis.maxRetriesPerRequest ?? null,
            retryStrategy:
                redis.retryStrategy ||
                ((times: number) => Math.min(times * 50, 2000)),
            reconnectOnError:
                redis.reconnectOnError ||
                ((error: Error) =>
                    error?.message?.includes('READONLY') ? 2 : false),
        };

        if (redis.host) options.host = redis.host;
        if (redis.port !== undefined) options.port = redis.port;
        if (redis.password) options.password = redis.password;
        if (redis.db !== undefined) options.db = redis.db;
        if (redis.tls) options.tls = redis.tls;

        return options;
    }
}
