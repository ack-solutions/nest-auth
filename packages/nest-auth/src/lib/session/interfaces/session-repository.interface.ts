import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';

/**
 * Interface for session repository implementations
 * Allows different storage backends (Database, Redis, Memory)
 */
export interface ISessionRepository {
    /**
     * Create a new session
     */
    create(session: SessionPayload): Promise<NestAuthSession>;

    /**
     * Find session by ID
     */
    findById(sessionId: string): Promise<NestAuthSession | null>;

    /**
     * Find all sessions for a user
     */
    findByUserId(userId: string): Promise<NestAuthSession[]>;

    /**
     * Find active sessions for a user (not expired)
     */
    findActiveByUserId(userId: string): Promise<NestAuthSession[]>;

    /**
     * Update session
     */
    update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession>;
    /**
     * Delete session by ID
     */
    delete(sessionId: string): Promise<void>;

    /**
     * Delete all sessions for a user
     */
    deleteByUserId(userId: string): Promise<void>;

    /**
     * Delete expired sessions
     */
    deleteExpired(): Promise<number>;

    /**
     * Count active sessions for a user
     */
    countActiveByUserId(userId: string): Promise<number>;

    /**
     * Update last active timestamp
     */
    updateLastActive(sessionId: string): Promise<void>;
}
