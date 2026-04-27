import { Equal, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { AuthConfigService } from '../services/auth-config.service';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { NestAuthLoginRequestDto } from '../../auth/dto/requests/login.request.dto';

export interface AuthProviderUser {
    userId: string;
    email?: string;
    phone?: string;
    username?: string;
    metadata?: Record<string, any>;
    /**
     * Set to `true` when the provider attests that this email belongs to
     * the user (e.g. Google's `email_verified` claim, or a verified primary
     * email returned by GitHub). The auth service will lift `emailVerifiedAt`
     * on the linked `NestAuthUser` when this is `true`.
     */
    emailVerified?: boolean;
    /**
     * Set to `true` when the provider attests that this phone belongs to
     * the user. Lifts `phoneVerifiedAt` on the linked `NestAuthUser`.
     */
    phoneVerified?: boolean;
}

export type LinkUserWith = 'email' | 'phone';


export abstract class BaseAuthProvider {
    abstract providerName: string;
    enabled: boolean;
    options: IAuthModuleOptions;
    skipMfa = false;

    constructor(
        protected readonly userRepository: Repository<NestAuthUser>,
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
        this.options = AuthConfigService.getOptions();
    }

    /**
     * Link a provider identity to a user
     * Checks for existing identity before creating to prevent duplicates
     */
    async linkToUser(userId: string, providerId: string, metadata?: Record<string, any>): Promise<void> {
        // Check if identity already exists to prevent duplicates
        const existingIdentity = await this.authIdentityRepository.findOne({
            where: {
                userId,
                provider: this.providerName,
                providerId: providerId,
            },
        });

        if (existingIdentity) {
            // Update metadata if provided
            if (metadata && Object.keys(metadata).length > 0) {
                existingIdentity.metadata = { ...existingIdentity.metadata, ...metadata };
                await this.authIdentityRepository.save(existingIdentity);
            }
            return;
        }

        // Create new identity only if it doesn't exist
        const identity = this.authIdentityRepository.create({
            userId,
            provider: this.providerName,
            providerId: providerId,
            metadata: metadata || {},
        });
        await this.authIdentityRepository.save(identity);
    }

    async findIdentityByUserId(userId: string): Promise<NestAuthIdentity | null> {
        return this.authIdentityRepository.findOne({
            where: {
                userId,
                provider: this.providerName,
            },
            relations: ['user'],
        });
    }

    /**
     * Find an existing identity for a provider
     */
    async findIdentity(providerId: string, tenantId?: string): Promise<NestAuthIdentity | null> {
        return this.authIdentityRepository.findOne({
            where: {
                provider: this.providerName,
                providerId: providerId,
                ...(tenantId ? { user: { userAccesses: { tenantId: Equal(tenantId) } } } : {}),
            },
            relations: ['user'],
        });
    }

    abstract validate(credentials: NestAuthLoginRequestDto['credentials'], tenantId?: string): Promise<AuthProviderUser | null>;

    abstract getRequiredFields(): string[];


    linkUserWith(): LinkUserWith {
        return 'email';
    }
}
