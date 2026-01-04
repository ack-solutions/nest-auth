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
            useFactory: (databaseStore: DatabaseSessionStore, memoryStore: MemorySessionRepository) => {
                const config = AuthConfigService.getOptions();
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

        // Session Manager
        SessionManagerService,
    ],
    exports: [
        SESSION_STORE,
        SESSION_REPOSITORY,
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
            RedisClient = require('ioredis').default || require('ioredis');

            const redisOptions = SessionModule.resolveRedisOptions(session);
            const clientOptions = SessionModule.buildRedisClientOptions(redisOptions);

            redisClient = redisOptions.url
                ? new RedisClient(redisOptions.url, clientOptions)
                : new RedisClient(clientOptions);

            const storeOptions: RedisSessionStoreOptions = {
                keyPrefix: redisOptions.keyPrefix,
                ttlSeconds: redisOptions.ttlSeconds ?? SessionModule.resolveDefaultTtlSeconds(session),
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
        const expiry = session?.sessionExpiry;
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
