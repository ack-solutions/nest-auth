import { Injectable } from '@nestjs/common';
import { BaseSessionRepository } from './base-session.repository';
import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import { v4 as uuidv4 } from 'uuid';

export interface RedisSessionStoreOptions {
    keyPrefix?: string;
    ttlSeconds?: number;
}

/**
 * Redis implementation of session store.
 *
 * REQUIREMENTS:
 * - npm install ioredis
 */
@Injectable()
export class RedisSessionStore extends BaseSessionRepository {
    private readonly keyPrefix: string;
    private readonly userSessionsPrefix: string;
    private readonly defaultTtlSeconds?: number;
    private readonly redis: any;

    constructor(redisClient: any, options: RedisSessionStoreOptions = {}) {
        super();

        if (!redisClient) {
            throw new Error(
                'RedisSessionStore requires the ioredis client. Install with: npm install ioredis'
            );
        }

        this.redis = redisClient;
        this.keyPrefix = this.normalizePrefix(options.keyPrefix || 'nest-auth:sess:');
        this.userSessionsPrefix = `${this.keyPrefix}user:`;
        this.defaultTtlSeconds = options.ttlSeconds;
    }

    private normalizePrefix(prefix: string): string {
        if (!prefix) return '';
        return prefix.endsWith(':') ? prefix : `${prefix}:`;
    }

    private getSessionKey(sessionId: string): string {
        return `${this.keyPrefix}${sessionId}`;
    }

    private getUserSessionsKey(userId: string): string {
        return `${this.userSessionsPrefix}${userId}`;
    }

    private getTtlSeconds(expiresAt?: Date): number | undefined {
        if (expiresAt instanceof Date) {
            const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
            if (ttl > 0) {
                return ttl;
            }
        }
        if (typeof this.defaultTtlSeconds === 'number' && this.defaultTtlSeconds > 0) {
            return this.defaultTtlSeconds;
        }
        return undefined;
    }

    private serializeSessionPartial(session: Partial<NestAuthSession>): Record<string, any> {
        const data: Record<string, any> = {};

        if (session.userId !== undefined) data.userId = session.userId;
        if (session.refreshToken !== undefined) data.refreshToken = session.refreshToken;
        if (session.userAgent !== undefined) data.userAgent = session.userAgent;
        if (session.deviceName !== undefined) data.deviceName = session.deviceName;
        if (session.ipAddress !== undefined) data.ipAddress = session.ipAddress;

        if (session.data !== undefined) {
            data.data = session.data === null ? null : JSON.stringify(session.data);
        }

        if (session.expiresAt !== undefined) {
            data.expiresAt = session.expiresAt ? new Date(session.expiresAt).toISOString() : null;
        }

        if (session.lastActive !== undefined) {
            data.lastActive = session.lastActive ? new Date(session.lastActive).toISOString() : null;
        }

        return data;
    }

    async create(session: SessionPayload): Promise<NestAuthSession> {
        const sessionId = session.id || uuidv4();
        const sessionKey = this.getSessionKey(sessionId);
        const userSessionsKey = this.getUserSessionsKey(session.userId!);

        const sessionData: NestAuthSession = {
            id: sessionId,
            userId: session.userId!,
            refreshToken: session.refreshToken,
            data: session.data,
            expiresAt: session.expiresAt,
            userAgent: session.userAgent,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            lastActive: session.lastActive || new Date(),
        } as NestAuthSession;

        // Exclude id from serialization since it's the Redis key
        const { id, ...sessionWithoutId } = sessionData;
        const serialized = this.serializeSession(sessionWithoutId);

        const pipeline = this.redis.pipeline();
        pipeline.hset(sessionKey, serialized);
        pipeline.sadd(userSessionsKey, sessionId);

        const ttlSeconds = this.getTtlSeconds(session.expiresAt);
        if (ttlSeconds) {
            pipeline.expire(sessionKey, ttlSeconds);
        }

        const results = await pipeline.exec();
        // Check for pipeline errors
        if (results) {
            const errors = results.filter(([err]) => err);
            if (errors.length > 0) {
                const errorMessages = errors.map(([err]) => err?.message || String(err)).join(', ');
                throw new Error(`Redis pipeline failed during session creation: ${errorMessages}`);
            }
        }
        return sessionData;
    }

    async findById(sessionId: string): Promise<NestAuthSession | null> {
        try {
            const sessionKey = this.getSessionKey(sessionId);
            const data = await this.redis.hgetall(sessionKey);

            if (!data || Object.keys(data).length === 0) {
                return null;
            }

            const session = this.deserializeSession(data);
            // Restore id since it's not stored in the hash
            session.id = sessionId;

            if (this.isExpired(session)) {
                await this.delete(sessionId);
                return null;
            }

            return session;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to retrieve session from Redis: ${errorMessage}`);
        }
    }

    async findByUserId(userId: string): Promise<NestAuthSession[]> {
        try {
            const userSessionsKey = this.getUserSessionsKey(userId);
            const sessionIds = await this.redis.smembers(userSessionsKey);

            if (!sessionIds.length) {
                return [];
            }

            const pipeline = this.redis.pipeline();
            for (const sessionId of sessionIds) {
                pipeline.hgetall(this.getSessionKey(sessionId));
            }

            const results = await pipeline.exec();
            if (!results) {
                return [];
            }

            // Check for pipeline errors
            const errors = results.filter(([err]) => err);
            if (errors.length > 0) {
                const errorMessages = errors.map(([err]) => err?.message || String(err)).join(', ');
                throw new Error(`Redis pipeline failed during findByUserId: ${errorMessages}`);
            }

            const sessions: NestAuthSession[] = [];
            const staleIds: string[] = [];

            results.forEach(([, data], index) => {
                if (!data || Object.keys(data).length === 0) {
                    staleIds.push(sessionIds[index]);
                    return;
                }

                const session = this.deserializeSession(data);
                // Restore id since it's not stored in the hash
                session.id = sessionIds[index];
                
                if (this.isExpired(session)) {
                    staleIds.push(sessionIds[index]);
                    return;
                }

                sessions.push(session);
            });

            if (staleIds.length) {
                try {
                    await this.redis.srem(userSessionsKey, ...staleIds);
                    const cleanup = this.redis.pipeline();
                    staleIds.forEach((sessionId) => cleanup.del(this.getSessionKey(sessionId)));
                    await cleanup.exec();
                } catch (cleanupError) {
                    // Log but don't fail - stale IDs will be cleaned up on next access
                    console.warn('Failed to cleanup stale session IDs:', cleanupError);
                }
            }

            return sessions;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to retrieve user sessions from Redis: ${errorMessage}`);
        }
    }

    async findActiveByUserId(userId: string): Promise<NestAuthSession[]> {
        const allSessions = await this.findByUserId(userId);
        return this.filterActive(allSessions);
    }

    async update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        try {
            const sessionKey = this.getSessionKey(sessionId);
            // Exclude id from updates if present
            const { id, ...updatesWithoutId } = updates;
            const serialized = this.serializeSessionPartial(updatesWithoutId);

            if (Object.keys(serialized).length === 0) {
                return await this.findById(sessionId);
            }

            const pipeline = this.redis.pipeline();
            pipeline.hset(sessionKey, serialized);

            if (updates.expiresAt) {
                const ttlSeconds = this.getTtlSeconds(new Date(updates.expiresAt));
                if (ttlSeconds) {
                    pipeline.expire(sessionKey, ttlSeconds);
                }
            }

            const results = await pipeline.exec();
            // Check for pipeline errors
            if (results) {
                const errors = results.filter(([err]) => err);
                if (errors.length > 0) {
                    const errorMessages = errors.map(([err]) => err?.message || String(err)).join(', ');
                    throw new Error(`Redis pipeline failed during session update: ${errorMessages}`);
                }
            }

            return await this.findById(sessionId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update session in Redis: ${errorMessage}`);
        }
    }

    async delete(sessionId: string): Promise<void> {
        try {
            const session = await this.findById(sessionId);
            if (!session) return;

            const sessionKey = this.getSessionKey(sessionId);
            const userSessionsKey = this.getUserSessionsKey(session.userId);

            await this.redis.del(sessionKey);
            await this.redis.srem(userSessionsKey, sessionId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete session from Redis: ${errorMessage}`);
        }
    }

    async deleteByUserId(userId: string): Promise<void> {
        try {
            const userSessionsKey = this.getUserSessionsKey(userId);
            const sessionIds = await this.redis.smembers(userSessionsKey);

            if (!sessionIds.length) {
                return;
            }

            const pipeline = this.redis.pipeline();
            for (const sessionId of sessionIds) {
                pipeline.del(this.getSessionKey(sessionId));
            }
            pipeline.del(userSessionsKey);

            const results = await pipeline.exec();
            // Check for pipeline errors
            if (results) {
                const errors = results.filter(([err]) => err);
                if (errors.length > 0) {
                    const errorMessages = errors.map(([err]) => err?.message || String(err)).join(', ');
                    throw new Error(`Redis pipeline failed during deleteByUserId: ${errorMessages}`);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete user sessions from Redis: ${errorMessage}`);
        }
    }

    async deleteExpired(): Promise<number> {
        // Redis automatically handles expiration via TTL
        return 0;
    }

    async countActiveByUserId(userId: string): Promise<number> {
        const activeSessions = await this.findActiveByUserId(userId);
        return activeSessions.length;
    }

    async updateLastActive(sessionId: string): Promise<void> {
        try {
            await this.update(sessionId, {
                lastActive: new Date(),
            } as any);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update last active timestamp in Redis: ${errorMessage}`);
        }
    }

    /**
     * Health check for Redis connection
     * Returns true if Redis is accessible, false otherwise
     */
    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }
}

// Backward compatibility alias
export { RedisSessionStore as RedisSessionRepository };
