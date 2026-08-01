import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseAuthProvider } from './base-auth.provider';
import { EMAIL_AUTH_PROVIDER, ERROR_CODES } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { EmailCredentialsDto } from '../../auth/dto/credentials/email-credentials.dto';
import { normalizedEmail } from '../../utils';

@Injectable()
export class EmailAuthProvider extends BaseAuthProvider {
    providerName = EMAIL_AUTH_PROVIDER;

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
        super(userRepository, authIdentityRepository);

        this.enabled = this.options.emailAuth?.enabled;
    }

    /**
     * Override findIdentity to normalize email before searching
     */
    async findIdentity(providerUserId: string, tenantId?: string): Promise<NestAuthIdentity | null> {
        const emailNorm = normalizedEmail(providerUserId);
        if (emailNorm) {
            const normalizedIdentity = await super.findIdentity(emailNorm, tenantId);
            if (normalizedIdentity) return normalizedIdentity;
        }
        return super.findIdentity(providerUserId, tenantId);
    }

    /**
     * Override linkToUser to normalize email before linking
     */
    async linkToUser(userId: string, providerUserId: string, metadata?: Record<string, any>): Promise<void> {
        const emailNorm = normalizedEmail(providerUserId);
        return super.linkToUser(userId, emailNorm || providerUserId, metadata);
    }

    async validate(credentials: EmailCredentialsDto, tenantId?: string) {
        const emailNorm = normalizedEmail(credentials.email);

        if (!emailNorm) {
            throw new BadRequestException('Email is required');
        }

        const identity = await this.findIdentity(emailNorm, tenantId);

        if (!identity?.user) {
            throw new UnauthorizedException({ message: 'Invalid credentials', code: ERROR_CODES.INVALID_CREDENTIALS });
        }

        // `passwordHash` is `select: false` on NestAuthUser, so the relation
        // loaded by `findIdentity` doesn't include it. The instance's fallback
        // path uses `BaseEntity.createQueryBuilder` which is brittle when the
        // entity isn't bound to the default DataSource. Load it explicitly here.
        const userWithHash = await this.userRepository.findOne({
            where: { id: identity.user.id },
            select: { id: true, passwordHash: true },
        });

        if (!userWithHash?.passwordHash) {
            throw new UnauthorizedException({ message: 'Invalid credentials', code: ERROR_CODES.INVALID_CREDENTIALS });
        }
        identity.user.passwordHash = userWithHash.passwordHash;

        if (!(await identity.user.validatePassword(credentials.password))) {
            throw new UnauthorizedException({ message: 'Invalid credentials', code: ERROR_CODES.INVALID_CREDENTIALS });
        }

        return {
            userId: identity.user?.id,
            email: identity.user?.email || '',
            metadata: identity.user,
        };
    }

    getRequiredFields(): string[] {
        return ['email', 'password'];
    }
}
