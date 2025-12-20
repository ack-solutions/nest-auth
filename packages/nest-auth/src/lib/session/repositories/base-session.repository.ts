import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import { ISessionRepository } from '../interfaces/session-repository.interface';
import ms from 'ms';

/**
 * Abstract base class for session repositories
 * Provides common functionality and helper methods
 */
export abstract class BaseSessionRepository implements ISessionRepository {

    // Abstract methods that must be implemented by subclasses
    abstract create(session: SessionPayload): Promise<NestAuthSession>;
    abstract findById(sessionId: string): Promise<NestAuthSession | null>;
    abstract findByUserId(userId: string): Promise<NestAuthSession[]>;
    abstract findActiveByUserId(userId: string): Promise<NestAuthSession[]>;
    abstract update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession>;
    abstract delete(sessionId: string): Promise<void>;
    abstract deleteByUserId(userId: string): Promise<void>;
    abstract deleteExpired(): Promise<number>;
    abstract countActiveByUserId(userId: string): Promise<number>;
    abstract updateLastActive(sessionId: string): Promise<void>;

    /**
     * Helper: Check if session is expired
     */
    protected isExpired(session: NestAuthSession): boolean {
        if (!session.expiresAt) return false;
        return new Date() > new Date(session.expiresAt);
    }

    /**
     * Helper: Calculate expiration date from duration string
     */
    protected calculateExpiresAt(duration: string | number): Date {
        const milliseconds = typeof duration === 'string' ? ms(duration) : duration;
        return new Date(Date.now() + milliseconds);
    }

    /**
     * Helper: Serialize session data for storage
     */
    protected serializeSession(session: SessionPayload | NestAuthSession): Record<string, any> {
        return {
            ...session,
            data: session.data ? JSON.stringify(session.data) : null,
            expiresAt: session.expiresAt instanceof Date
                ? session.expiresAt.toISOString()
                : session.expiresAt,
            lastActive: session.lastActive instanceof Date
                ? session.lastActive.toISOString()
                : session.lastActive,
        };
    }

    /**
     * Helper: Deserialize session data from storage
     */
    protected deserializeSession(data: Record<string, any>): NestAuthSession {
        return {
            ...data,
            data: data['data'] ? JSON.parse(data['data']) : null,
            expiresAt: data['expiresAt'] ? new Date(data['expiresAt']) : null,
            lastActive: data['lastActive'] ? new Date(data['lastActive']) : null,
        } as NestAuthSession;
    }

    /**
     * Helper: Filter only active sessions (not expired)
     */
    protected filterActive(sessions: NestAuthSession[]): NestAuthSession[] {
        return sessions.filter(session => !this.isExpired(session));
    }
}
