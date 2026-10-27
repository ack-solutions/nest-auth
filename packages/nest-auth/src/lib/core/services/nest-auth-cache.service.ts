import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthStateCache } from './auth-state-cache';
import { AuthConfigService } from './auth-config.service';
import { NestAuthEvents } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';

/** DI token for the {@link AuthStateCache} backing {@link NestAuthCacheService}. */
export const AUTH_STATE_CACHE = 'NEST_AUTH_STATE_CACHE';

/**
 * The per-request user facts the guard needs, and nothing else.
 *
 * Deliberately NOT the user row: caching a whole entity invites staleness bugs
 * in fields nobody checked. These three are the only ones the guard reads.
 */
export interface CachedUserState {
    isActive: boolean;
    mustChangePassword: boolean;
    emailVerified: boolean;
}

/** Default TTL when the cache is shared across instances (Redis). */
export const DEFAULT_DISTRIBUTED_USER_STATE_TTL_SECONDS = 300;
/** Default TTL for the in-process cache, where invalidation is local only. */
export const DEFAULT_IN_PROCESS_USER_STATE_TTL_SECONDS = 5;

/**
 * Caches the small amount of user state the auth guard needs on every request,
 * so a warm authenticated request costs NO database query.
 *
 * ## Why this exists
 *
 * The guard used to run `SELECT id, isActive, mustChangePassword,
 * emailVerifiedAt FROM nest_auth_users WHERE id = $1` on every single
 * authenticated request, even with the Redis session store. That is one
 * database round trip per API call, for data that changes very rarely.
 *
 * ## Correctness over speed
 *
 * A stale `isActive` is an authentication bypass: a deactivated account would
 * keep working until the entry expired. So this cache is only safe because
 * every write to those fields invalidates it:
 *
 * 1. {@link NestAuthUserCacheSubscriber} — a TypeORM entity subscriber on
 *    `NestAuthUser`. This is the real chokepoint: it fires for `UserService`
 *    writes AND for a bare `user.save()` anywhere in the codebase.
 * 2. `AuthSessionEventListener` — already revokes every session when an account
 *    is deactivated or deleted, so those accounts lose their session outright.
 * 3. {@link invalidateUser} — exported for writes the ORM cannot see (raw SQL,
 *    a QueryBuilder bulk `UPDATE`, a migration, another service sharing the
 *    database).
 *
 * The TTL is the backstop for (3) when someone forgets, not the primary
 * mechanism.
 *
 * ## Defaults
 *
 * Enabled by default ONLY when the cache is shared across instances (the Redis
 * session store), because that is the configuration where invalidation on one
 * instance reaches the others. With the database or memory session store the
 * cache is per process, so it is OFF by default and must be opted into with
 * `session.userStateCache.enabled: true` — accepting a staleness window of
 * `ttlSeconds` on other instances.
 */
@Injectable()
export class NestAuthCacheService {
    private static readonly logger = new Logger('NestAuthCache');

    constructor(
        @Inject(AUTH_STATE_CACHE) private readonly cache: AuthStateCache,
        @Optional() private readonly eventEmitter?: EventEmitter2,
    ) { }

    /** Is the cache shared across API instances? */
    get distributed(): boolean {
        return this.cache.distributed;
    }

    /**
     * Is user-state caching on? See the class docs for why the default differs
     * between a shared and a per-process cache.
     */
    get enabled(): boolean {
        const configured = AuthConfigService.getOptions()?.session?.userStateCache?.enabled;
        if (typeof configured === 'boolean') return configured;
        return this.cache.distributed;
    }

    /** How long a cached entry may live. */
    get ttlSeconds(): number {
        const configured = AuthConfigService.getOptions()?.session?.userStateCache?.ttlSeconds;
        if (typeof configured === 'number' && configured > 0) return Math.floor(configured);
        return this.cache.distributed
            ? DEFAULT_DISTRIBUTED_USER_STATE_TTL_SECONDS
            : DEFAULT_IN_PROCESS_USER_STATE_TTL_SECONDS;
    }

    private userStateKey(userId: string): string {
        return `user-state:${userId}`;
    }

    /**
     * The guard's user-state read.
     *
     * Returns `null` when the account does not exist. A missing account is
     * never cached — it must stay a hard database answer, so a deleted account
     * can never be served from a stale entry.
     */
    async getUserState(userId: string): Promise<CachedUserState | null> {
        if (!userId) return null;

        if (this.enabled) {
            const hit = await this.cache.get<CachedUserState>(this.userStateKey(userId));
            if (hit) return hit;
        }

        const user = await NestAuthUser.findOne({
            where: { id: userId },
            select: ['id', 'isActive', 'mustChangePassword', 'emailVerifiedAt'],
        });

        if (!user) return null;

        const state: CachedUserState = {
            isActive: user.isActive !== false,
            mustChangePassword: user.mustChangePassword === true,
            emailVerified: !!user.emailVerifiedAt,
        };

        if (this.enabled) {
            await this.cache.set(this.userStateKey(userId), state, this.ttlSeconds);
        }

        return state;
    }

    /**
     * Drop an account's cached state so the very next request re-reads it.
     *
     * Call this after any write to `isActive`, `mustChangePassword` or
     * `emailVerifiedAt` that the ORM cannot see — raw SQL, a QueryBuilder bulk
     * `UPDATE`, a migration, or another service writing the same database.
     * Writes that go through TypeORM are already covered by
     * {@link NestAuthUserCacheSubscriber}.
     *
     * Safe to call when caching is disabled: it is then a no-op delete.
     *
     * @example
     * ```ts
     * await this.dataSource.query(
     *   'UPDATE nest_auth_users SET "isActive" = false WHERE id = $1', [userId],
     * );
     * await this.nestAuthCache.invalidateUser(userId); // without this, stale until TTL
     * ```
     */
    async invalidateUser(userId: string): Promise<void> {
        if (!userId) return;
        await this.cache.del(this.userStateKey(userId));
        this.eventEmitter?.emit(NestAuthEvents.USER_STATE_INVALIDATED, { userId });
    }

    /** Invalidate several accounts — e.g. after a bulk deactivation. */
    async invalidateUsers(userIds: string[]): Promise<void> {
        await Promise.all((userIds ?? []).map((id) => this.invalidateUser(id)));
    }

    /**
     * Log the chosen configuration once at boot, so an operator can see
     * whether caching is on and how stale it may get.
     */
    logConfiguration(): void {
        if (!this.enabled) {
            NestAuthCacheService.logger.log(
                'User-state caching is OFF; the auth guard reads the user row on every request.',
            );
            return;
        }
        NestAuthCacheService.logger.log(
            `User-state caching is ON (${this.distributed ? 'shared across instances' : 'per process'}, ` +
            `ttl ${this.ttlSeconds}s).` +
            (this.distributed
                ? ''
                : ' Invalidation does NOT reach other instances — they stay stale until the ttl expires.'),
        );
    }
}
