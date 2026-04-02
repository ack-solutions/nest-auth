import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { BaseAuthProvider, LinkUserWith } from './base-auth.provider';
import { PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { PhoneCredentialsDto } from '../../auth/dto/credentials/phone-credentials.dto';
import { normalizedPhone } from '../../utils';

@Injectable()
export class PhoneAuthProvider extends BaseAuthProvider {
    providerName = PHONE_AUTH_PROVIDER;

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
        super(userRepository, authIdentityRepository);

        this.enabled = this.options.phoneAuth?.enabled;
    }

    async findIdentity(providerUserId: string, tenantId?: string): Promise<NestAuthIdentity | null> {
        const phoneNorm = normalizedPhone(providerUserId);
        if (phoneNorm) {
            const normalizedIdentity = await super.findIdentity(phoneNorm, tenantId);
            if (normalizedIdentity) return normalizedIdentity;
        }
        return super.findIdentity(providerUserId, tenantId);
    }

    async validate(credentials: PhoneCredentialsDto) {
        const identity = await this.findIdentity(credentials.phone);

        if (!identity?.user || !(await identity.user.validatePassword(credentials.password))) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return {
            userId: identity.user?.phone,
            phone: identity.user?.phone || '',
            metadata: identity.user,
        };
    }

    getRequiredFields(): string[] {
        return ['phone', 'password'];
    }

    async linkToUser(userId: string, providerUserId: string, metadata?: Record<string, any>): Promise<void> {
        const phoneNorm = normalizedPhone(providerUserId);
        return super.linkToUser(userId, phoneNorm || providerUserId, metadata);
    }

    override linkUserWith(): LinkUserWith {
        return 'phone';
    }
}
