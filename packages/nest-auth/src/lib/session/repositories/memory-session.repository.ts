import { Injectable } from '@nestjs/common';
import { BaseSessionRepository } from './base-session.repository';
import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory implementation of session repository
 * Useful for testing and development
 * WARNING: Sessions are lost on server restart!
 */
@Injectable()
export class MemorySessionRepository extends BaseSessionRepository {
    private sessions: Map<string, NestAuthSession> = new Map();
    private userSessions: Map<string, Set<string>> = new Map();

    async create(session: SessionPayload): Promise<NestAuthSession> {
        const sessionId = session.id || uuidv4();

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
            createdAt: new Date(),
            updatedAt: new Date(),
        } as NestAuthSession;

        this.sessions.set(sessionId, sessionData);

        // Track user sessions
        if (!this.userSessions.has(session.userId)) {
            this.userSessions.set(session.userId, new Set());
        }
        this.userSessions.get(session.userId)!.add(sessionId);

        return sessionData;
    }

    async findById(sessionId: string): Promise<NestAuthSession | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        // Check expiration
        if (this.isExpired(session)) {
            await this.delete(sessionId);
            return null;
        }

        return session;
    }

    async findByUserId(userId: string): Promise<NestAuthSession[]> {
        const sessionIds = this.userSessions.get(userId) || new Set();
        const sessions: NestAuthSession[] = [];

        for (const sessionId of sessionIds) {
            const session = await this.findById(sessionId);
            if (session) {
                sessions.push(session);
            }
        }

        return sessions.sort((a, b) =>
            (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
        );
    }

    async findActiveByUserId(userId: string): Promise<NestAuthSession[]> {
        const allSessions = await this.findByUserId(userId);
        return this.filterActive(allSessions);
    }

    async update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        const session = await this.findById(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const updated = {
            ...session,
            ...updates,
            updatedAt: new Date(),
        } as NestAuthSession;

        this.sessions.set(sessionId, updated);
        return updated;
    }

    async delete(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        this.sessions.delete(sessionId);

        // Remove from user sessions
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
            userSessionIds.delete(sessionId);
            if (userSessionIds.size === 0) {
                this.userSessions.delete(session.userId);
            }
        }
    }

    async deleteByUserId(userId: string): Promise<void> {
        const sessionIds = this.userSessions.get(userId) || new Set();

        for (const sessionId of sessionIds) {
            this.sessions.delete(sessionId);
        }

        this.userSessions.delete(userId);
    }

    async deleteExpired(): Promise<number> {
        let count = 0;
        const now = new Date();

        for (const [sessionId, session] of this.sessions.entries()) {
            if (this.isExpired(session)) {
                await this.delete(sessionId);
                count++;
            }
        }

        return count;
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

    /**
     * Clear all sessions (useful for testing)
     */
    clear(): void {
        this.sessions.clear();
        this.userSessions.clear();
    }
}
