import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
    DataSource,
    EntitySubscriberInterface,
    InsertEvent,
    RemoveEvent,
    SoftRemoveEvent,
    UpdateEvent,
} from 'typeorm';
import { NestAuthUser } from '../entities/user.entity';
import { NestAuthCacheService } from '../../core/services/nest-auth-cache.service';

/**
 * Invalidates a user's cached auth state whenever their row changes.
 *
 * ## Why a subscriber and not an event listener
 *
 * `NestAuthCacheService` makes the guard skip its per-request user read, which
 * is only safe if EVERY write to `isActive`, `mustChangePassword` or
 * `emailVerifiedAt` drops the cached copy. Hooking `UserService` would miss
 * the writes that do not go through it — and there are some, e.g. the admin
 * console's own `user.save()` in `admin-users.controller.ts`. A TypeORM entity
 * subscriber is the real chokepoint: it fires for every ORM write to the
 * entity regardless of which service made it.
 *
 * ## What it still cannot see
 *
 * TypeORM does not run subscribers for QueryBuilder bulk statements
 * (`.update().where()...execute()`), raw SQL, migrations, or writes made by a
 * different application sharing the database. Those callers must invalidate
 * explicitly with {@link NestAuthCacheService.invalidateUser}. That is why the
 * cached entry also carries a TTL — a backstop, not the mechanism.
 *
 * Registered by pushing onto the live `DataSource` at module init, so the
 * consumer does not have to add anything to their TypeORM `subscribers`
 * config.
 */
@Injectable()
export class NestAuthUserCacheSubscriber
    implements EntitySubscriberInterface<NestAuthUser>, OnModuleInit {
    private static readonly logger = new Logger('NestAuthUserCacheSubscriber');

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly cacheService: NestAuthCacheService,
    ) { }

    onModuleInit(): void {
        // Registering here rather than via the DataSource's `subscribers`
        // option keeps this invisible to the consumer's TypeORM config.
        if (!this.dataSource.subscribers.includes(this)) {
            this.dataSource.subscribers.push(this);
        }
        this.cacheService.logConfiguration();
    }

    listenTo() {
        return NestAuthUser;
    }

    /**
     * A fresh row cannot have a cached entry yet — except for the one case
     * that matters: an id reused after a delete, or a cache entry written by a
     * concurrent request between the delete and the insert. Cheap to be safe.
     */
    async afterInsert(event: InsertEvent<NestAuthUser>): Promise<void> {
        await this.invalidate(event.entity?.id);
    }

    async afterUpdate(event: UpdateEvent<NestAuthUser>): Promise<void> {
        const id = (event.entity as NestAuthUser | undefined)?.id ?? event.databaseEntity?.id;
        await this.invalidate(id);
    }

    async afterRemove(event: RemoveEvent<NestAuthUser>): Promise<void> {
        await this.invalidate(event.entity?.id ?? (event.entityId as string) ?? event.databaseEntity?.id);
    }

    async afterSoftRemove(event: SoftRemoveEvent<NestAuthUser>): Promise<void> {
        await this.invalidate(event.entity?.id ?? (event.entityId as string) ?? event.databaseEntity?.id);
    }

    /**
     * Invalidation must never break the write that triggered it. A failed
     * cache delete degrades to staleness bounded by the TTL; throwing here
     * would roll back a legitimate user update.
     */
    private async invalidate(userId?: string): Promise<void> {
        if (!userId) return;
        try {
            await this.cacheService.invalidateUser(userId);
        } catch (error) {
            NestAuthUserCacheSubscriber.logger.warn(
                `Failed to invalidate cached auth state for user ${userId}; it will stay stale ` +
                `for up to ${this.cacheService.ttlSeconds}s. ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
