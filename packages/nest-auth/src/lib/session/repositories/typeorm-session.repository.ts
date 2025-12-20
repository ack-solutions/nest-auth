import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { BaseSessionRepository } from './base-session.repository';
import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * TypeORM implementation of session repository
 * Stores sessions in PostgreSQL/MySQL database
 */
@Injectable()
export class TypeORMSessionRepository extends BaseSessionRepository {
    constructor(
        @InjectRepository(NestAuthSession)
        private readonly repository: Repository<NestAuthSession>,
    ) {
        super();
    }

    async create(session: SessionPayload): Promise<NestAuthSession> {
        const sessionEntity = this.repository.create(session);

        return await this.repository.save(sessionEntity);
    }

    async findById(sessionId: string): Promise<NestAuthSession | null> {
        return await this.repository.findOne({
            where: { id: sessionId },
            relations: ['user'],
        });
    }

    async findByUserId(userId: string): Promise<NestAuthSession[]> {
        return await this.repository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async findActiveByUserId(userId: string): Promise<NestAuthSession[]> {
        return await this.repository.find({
            where: {
                userId,
                expiresAt: MoreThan(new Date()),
            },
            order: { lastActive: 'DESC' },
        });
    }

    async update(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        await this.repository.update(sessionId, updates);
        return await this.findById(sessionId);
    }

    async delete(sessionId: string): Promise<void> {
        await this.repository.delete(sessionId);
    }

    async deleteByUserId(userId: string): Promise<void> {
        await this.repository.delete({ userId });
    }

    async deleteExpired(): Promise<number> {
        const result = await this.repository.delete({
            expiresAt: LessThan(new Date()),
        });
        return result.affected || 0;
    }

    async countActiveByUserId(userId: string): Promise<number> {
        return await this.repository.count({
            where: {
                userId,
                expiresAt: MoreThan(new Date()),
            },
        });
    }

    async updateLastActive(sessionId: string): Promise<void> {
        await this.repository.update(sessionId, {
            lastActive: new Date(),
        });
    }
}
