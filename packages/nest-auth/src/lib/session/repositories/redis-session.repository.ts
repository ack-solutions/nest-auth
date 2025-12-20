import { Injectable, Inject, Optional } from '@nestjs/common';
import { BaseSessionRepository } from './base-session.repository';
import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import { v4 as uuidv4 } from 'uuid';

// Lazy load Redis to make it optional
let Redis: any;
let InjectRedis: any;

try {
    Redis = require('ioredis').default || require('ioredis');
    const ioredisModule = require('@nestjs-modules/ioredis');
    InjectRedis = ioredisModule.InjectRedis;
} catch (e) {
    // Redis is not installed, that's okay if not using Redis sessions
}

/**
 * Redis implementation of session repository
 * Stores sessions in Redis for fast access
 *
 * REQUIREMENTS:
 * - npm install ioredis @nestjs-modules/ioredis
 * - Configure Redis in NestAuthModule
 */
@Injectable()
export class RedisSessionRepository extends BaseSessionRepository {
    private readonly prefix = 'nest-auth:session:';
    private readonly userSessionsPrefix = 'nest-auth:user-sessions:';
    private redis: any;

    constructor(
        @Optional()
        @Inject('REDIS_CLIENT')
        redisClient?: any
    ) {
        super();

        if (!redisClient) {
            throw new Error(
                'RedisSessionRepository requires ioredis and @nestjs-modules/ioredis packages. ' +
                'Install them with: npm install ioredis @nestjs-modules/ioredis'
            );
        }

        this.redis = redisClient;
    }

    private getSessionKey(sessionId: string): string {
        return `${this.prefix}${sessionId}`;
    }

    private getUserSessionsKey(userId: string): string {
        return `${this.userSessionsPrefix}${userId}`;
    }

    async create(session: SessionPayload): Promise<NestAuthSession> {
        const sessionId = session.id || uuidv4();
        const sessionKey = this.getSessionKey(sessionId);
        const userSessionsKey = this.getUserSessionsKey(session.userId);

        const sessionData: NestAuthSession = {
            id: sessionId,
            userId: session.userId,
            refreshToken: session.refreshToken,
            data: session.data,
            expiresAt: session.expiresAt,
            userAgent: session.userAgent,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            lastActive: session.lastActive || new Date(),
        } as NestAuthSession;

        // Store session as hash
        const serialized = this.serializeSession(sessionData);
        await this.redis.hmset(sessionKey, serialized);

        // Add to user's sessions set
        await this.redis.sadd(userSessionsKey, sessionId);

        // Set TTL
        const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
        if (ttl > 0) {
            await this.redis.expire(sessionKey, ttl);
        }

        return sessionData;
    }

    async findById(sessionId: string): Promise<NestAuthSession | null> {
        const sessionKey = this.getSessionKey(sessionId);
        const data = await this.redis.hgetall(sessionKey);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return this.deserializeSession(data);
    }

    async findByUserId(userId: string): Promise<NestAuthSession[]> {
        const userSessionsKey = this.getUserSessionsKey(userId);
        const sessionIds = await this.redis.smembers(userSessionsKey);

        const sessions: NestAuthSession[] = [];
        for (const sessionId of sessionIds) {
            const session = await this.findById(sessionId);
            if (session) {
                sessions.push(session);
            }
        }

        return sessions;
    }

    async findActiveByUserId(userId: string): Promise<NestAuthSession[]> {
        const allSessions = await this.findByUserId(userId);
        return this.filterActive(allSessions);
    }

    async update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        const sessionKey = this.getSessionKey(sessionId);
        const serialized = this.serializeSession(updates as any);

        await this.redis.hmset(sessionKey, serialized);

        return await this.findById(sessionId);
    }

    async delete(sessionId: string): Promise<void> {
        const session = await this.findById(sessionId);
        if (!session) return;

        const sessionKey = this.getSessionKey(sessionId);
        const userSessionsKey = this.getUserSessionsKey(session.userId);

        await this.redis.del(sessionKey);
        await this.redis.srem(userSessionsKey, sessionId);
    }

    async deleteByUserId(userId: string): Promise<void> {
        const userSessionsKey = this.getUserSessionsKey(userId);
        const sessionIds = await this.redis.smembers(userSessionsKey);

        const pipeline = this.redis.pipeline();
        for (const sessionId of sessionIds) {
            pipeline.del(this.getSessionKey(sessionId));
        }
        pipeline.del(userSessionsKey);

        await pipeline.exec();
    }

    async deleteExpired(): Promise<number> {
        // Redis automatically handles expiration via TTL
        // This is a no-op for Redis, but we implement it for interface compliance
        return 0;
    }

    async countActiveByUserId(userId: string): Promise<number> {
        const activeSessions = await this.findActiveByUserId(userId);
        return activeSessions.length;
    }

    async updateLastActive(sessionId: string): Promise<void> {
        await this.update(sessionId, {
            lastActive: new Date(),
        } as any);
    }
}
