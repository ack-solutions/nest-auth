import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthAccessKey } from '../entities/access-key.entity';
import { NestAuthUser } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes, createHash } from 'crypto';
import { NestAuthEvents } from '../../auth.constants';

@Injectable()
export class AccessKeyService {
    constructor(
        @InjectRepository(NestAuthAccessKey)
        private accessKeyRepository: Repository<NestAuthAccessKey>,

        @InjectRepository(NestAuthUser)
        private userRepository: Repository<NestAuthUser>,
        private eventEmitter: EventEmitter2
    ) { }

    private generateKeyPair(): { publicKey: string; privateKey: string } {
        const privateKey = randomBytes(32).toString('hex');
        const publicKey = createHash('sha256').update(privateKey).digest('hex');
        return { publicKey, privateKey };
    }

    async createAccessKey(userId: string, name: string): Promise<NestAuthAccessKey> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${userId} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        const { publicKey, privateKey } = this.generateKeyPair();

        const accessKey = this.accessKeyRepository.create({
            name,
            publicKey,
            privateKey,
            userId,
        });

        const savedKey = await this.accessKeyRepository.save(accessKey);

        // Emit access key created event
        await this.eventEmitter.emitAsync(
            NestAuthEvents.ACCESS_KEY_CREATED,
            {
                accessKey: savedKey,
                userId
            }
        );

        return savedKey;
    }

    async getAccessKey(publicKey: string): Promise<NestAuthAccessKey> {
        const accessKey = await this.accessKeyRepository.findOne({
            where: { publicKey },
            relations: ['user']
        });

        if (!accessKey) {
            throw new NotFoundException({
                message: 'Invalid access key',
                code: 'INVALID_ACCESS_KEY'
            });
        }

        if (!accessKey.isActive) {
            throw new BadRequestException({
                message: 'Access key is inactive',
                code: 'INACTIVE_ACCESS_KEY'
            });
        }

        if (accessKey.expiresAt && accessKey.expiresAt < new Date()) {
            throw new BadRequestException({
                message: 'Access key has expired',
                code: 'EXPIRED_ACCESS_KEY'
            });
        }

        return accessKey;
    }

    async validateAccessKey(publicKey: string, privateKey: string): Promise<boolean> {
        const accessKey = await this.getAccessKey(publicKey);
        return accessKey.privateKey === privateKey;
    }

    async getUserAccessKeys(userId: string): Promise<NestAuthAccessKey[]> {
        return this.accessKeyRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' }
        });
    }

    async deactivateAccessKey(publicKey: string): Promise<NestAuthAccessKey> {
        const accessKey = await this.getAccessKey(publicKey);
        accessKey.isActive = false;

        const updatedKey = await this.accessKeyRepository.save(accessKey);

        // Emit access key deactivated event
        await this.eventEmitter.emitAsync(
            NestAuthEvents.ACCESS_KEY_DEACTIVATED,
            {
                accessKey: updatedKey,
                userId: updatedKey.userId
            }
        );

        return updatedKey;
    }

    async updateAccessKeyLastUsed(publicKey: string): Promise<void> {
        const accessKey = await this.getAccessKey(publicKey);
        accessKey.lastUsedAt = new Date();
        await this.accessKeyRepository.save(accessKey);
    }

    async setAccessKeyExpiry(publicKey: string, expiresAt: Date): Promise<NestAuthAccessKey> {
        const accessKey = await this.getAccessKey(publicKey);
        accessKey.expiresAt = expiresAt;
        return this.accessKeyRepository.save(accessKey);
    }

    async deleteAccessKey(publicKey: string): Promise<void> {
        const accessKey = await this.getAccessKey(publicKey);

        // Emit access key deleted event before deletion
        await this.eventEmitter.emitAsync(
            NestAuthEvents.ACCESS_KEY_DELETED,
            {
                accessKey,
                userId: accessKey.userId
            }
        );

        await this.accessKeyRepository.remove(accessKey);
    }
}
