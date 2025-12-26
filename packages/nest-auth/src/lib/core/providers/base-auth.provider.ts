import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { AuthConfigService } from '../services/auth-config.service';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';

export interface AuthProviderUser {
    userId: string;
    email?: string;
    phone?: string;
    username?: string;
    metadata?: Record<string, any>;
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
     */
    async linkToUser(userId: string, providerUserId: string, metadata?: Record<string, any>): Promise<void> {
        const identity = this.authIdentityRepository.create({
            userId,
            provider: this.providerName,
            providerId: providerUserId,
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
    async findIdentity(providerUserId: string): Promise<NestAuthIdentity | null> {
        return this.authIdentityRepository.findOne({
            where: {
                provider: this.providerName,
                providerId: providerUserId,
            },
            relations: ['user'],
        });
    }

    abstract validate(credentials: any): Promise<AuthProviderUser | null>;

    abstract getRequiredFields(): string[];


    linkUserWith(): LinkUserWith {
        return 'email';
    }
}
