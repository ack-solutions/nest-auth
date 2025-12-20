import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseAuthProvider } from './base-auth.provider';
import { EMAIL_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';

@Injectable()
export class EmailAuthProvider extends BaseAuthProvider {
    providerName = EMAIL_AUTH_PROVIDER;

    constructor(
        readonly dataSource: DataSource,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.enabled = this.options.emailAuth?.enabled;
    }

    /**
     * Normalize email to lowercase for case-insensitive matching
     */
    private normalizeEmail(email: string | null | undefined): string | null {
        if (!email) return null;
        return email.toLowerCase().trim();
    }

    /**
     * Override findIdentity to normalize email before searching
     */
    async findIdentity(providerUserId: string): Promise<NestAuthIdentity | null> {
        const normalizedEmail = this.normalizeEmail(providerUserId);
        return super.findIdentity(normalizedEmail || providerUserId);
    }

    /**
     * Override linkToUser to normalize email before linking
     */
    async linkToUser(userId: string, providerUserId: string, metadata?: Record<string, any>): Promise<void> {
        const normalizedEmail = this.normalizeEmail(providerUserId);
        return super.linkToUser(userId, normalizedEmail || providerUserId, metadata);
    }

    async validate(credentials: { email?: string; password?: string }) {
        // Normalize email to lowercase for case-insensitive matching
        const normalizedEmail = this.normalizeEmail(credentials.email);

        if (!normalizedEmail) {
            throw new UnauthorizedException('Email is required');
        }

        const identity = await this.findIdentity(normalizedEmail);

        if (!identity?.user || !(await identity.user.validatePassword(credentials.password))) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return {
            userId: identity.user?.email,
            email: identity.user?.email || '',
            metadata: identity.user,
        };
    }

    getRequiredFields(): string[] {
        return ['email', 'password'];
    }
}
