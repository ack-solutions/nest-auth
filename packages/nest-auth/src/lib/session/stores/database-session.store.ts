import { Injectable } from '@nestjs/common';
import { SessionStore } from '../interfaces/session-store.interface';
import { TypeORMSessionRepository } from '../repositories/typeorm-session.repository';
import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';

/**
 * Database-backed session store (default).
 */
@Injectable()
export class DatabaseSessionStore implements SessionStore {
    constructor(private readonly repository: TypeORMSessionRepository) {}

    create(session: SessionPayload): Promise<NestAuthSession> {
        return this.repository.create(session);
    }

    findById(sessionId: string): Promise<NestAuthSession | null> {
        return this.repository.findById(sessionId);
    }

    findByUserId(userId: string): Promise<NestAuthSession[]> {
        return this.repository.findByUserId(userId);
    }

    findActiveByUserId(userId: string): Promise<NestAuthSession[]> {
        return this.repository.findActiveByUserId(userId);
    }

    update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        return this.repository.update(sessionId, updates);
    }

    delete(sessionId: string): Promise<void> {
        return this.repository.delete(sessionId);
    }

    deleteByUserId(userId: string): Promise<void> {
        return this.repository.deleteByUserId(userId);
    }

    deleteExpired(): Promise<number> {
        return this.repository.deleteExpired();
    }

    countActiveByUserId(userId: string): Promise<number> {
        return this.repository.countActiveByUserId(userId);
    }

    updateLastActive(sessionId: string): Promise<void> {
        return this.repository.updateLastActive(sessionId);
    }
}
