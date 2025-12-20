import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthSession } from './entities/session.entity';
import { SessionManagerService, SESSION_REPOSITORY } from './services/session-manager.service';
import { TypeORMSessionRepository } from './repositories/typeorm-session.repository';
import { MemorySessionRepository } from './repositories/memory-session.repository';
import { CoreModule } from '../core/core.module';
import { SessionStorageType } from '../core/interfaces/session-options.interface';
import { AuthConfigService } from '../core/services/auth-config.service';

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

        // Session Repository Provider (dynamically chooses storage)
        {
            provide: SESSION_REPOSITORY,
            useFactory: (typeormRepo: TypeORMSessionRepository) => {
                const config = AuthConfigService.getOptions();
                const storageType = config.session?.storageType || SessionStorageType.DATABASE;

                // Handle Redis storage
                if (storageType === SessionStorageType.REDIS) {
                    return SessionModule.createRedisRepository(config.session?.redisUrl);
                }

                if (storageType === SessionStorageType.MEMORY) {
                    return new MemorySessionRepository();
                }

                // Default to database storage
                return typeormRepo;
            },
            inject: [TypeORMSessionRepository],
        },

        // Session Manager
        SessionManagerService,
    ],
    exports: [
        SESSION_REPOSITORY,
        SessionManagerService,
        TypeORMSessionRepository,
        MemorySessionRepository,
    ],
})
export class SessionModule {
    /**
     * Create Redis repository instance
     * Only called if Redis storage is configured
     */
    private static createRedisRepository(redisUrl?: string): any {
        let RedisSessionRepository: any;
        let ioredisModule: any;
        let redisClient: any;

        // Try to load Redis modules
        try {
            // Lazy load Redis repository
            RedisSessionRepository = require('./repositories/redis-session.repository').RedisSessionRepository;
            ioredisModule = require('@nestjs-modules/ioredis');
            const Redis = require('ioredis').default || require('ioredis');

            // Create Redis client
            if (redisUrl) {
                redisClient = new Redis(redisUrl);
            } else {
                redisClient = new Redis(); // Uses default localhost:6379
            }

            // Return repository instance
            return new RedisSessionRepository(redisClient);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('Cannot find module')) {
                throw new Error(
                    '❌ Redis session storage is configured but packages are not installed.\n' +
                    '   Install them with: npm install ioredis @nestjs-modules/ioredis\n' +
                    '   Or change session.storageType to SessionStorageType.DATABASE'
                );
            }

            throw new Error(
                `❌ Failed to initialize Redis session storage: ${errorMessage}\n` +
                '   Make sure Redis server is running and accessible.'
            );
        }
    }
}
