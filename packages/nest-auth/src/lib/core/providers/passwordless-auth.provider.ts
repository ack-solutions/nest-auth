import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { AuthProviderUser, BaseAuthProvider } from './base-auth.provider';
import {
    EMAIL_AUTH_PROVIDER,
    ERROR_CODES,
    PASSWORDLESS_AUTH_PROVIDER,
    PHONE_AUTH_PROVIDER,
} from '../../auth.constants';
import { normalizedEmail, normalizedPhone } from '../../utils';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { PasswordlessOtpCredentialsDto } from 'src/lib/auth/dto/credentials/passwordless-otp-credentials.dto';

/**
 * Passwordless login (email/SMS OTP or magic link). Registered from AuthModule when
 * `passwordless.enabled` is true; use `POST /auth/login` with `providerName: 'passwordless'`.
 */
@Injectable()
export class PasswordlessAuthProvider extends BaseAuthProvider {
    providerName = PASSWORDLESS_AUTH_PROVIDER;

    otpRepository: Repository<NestAuthOTP>;

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
        super(userRepository, authIdentityRepository);
        this.enabled = this.options.passwordless?.enabled === true;

        this.otpRepository = NestAuthOTP.getRepository();
    }

    async validate(
        credentials: PasswordlessOtpCredentialsDto,
        tenantId?: string,
    ): Promise<AuthProviderUser> {
        const identifier = credentials.identifier;
        const code = credentials.code;
        if (typeof identifier !== 'string' || typeof code !== 'string') {
            throw new BadRequestException({
                message: 'identifier and code are required for passwordless OTP login',
            });
        }

        for (const ch of credentials.channels) {
            const found = await this.findIdentityForChannel(ch, identifier, tenantId);
            if (!found?.identity.user) {
                continue;
            }
            const { identity, providerUserId } = found;

            const ok = await this.consumeOtp(
                identity.userId,
                NestAuthOTPTypeEnum.PASSWORDLESS_LOGIN,
                code,
            );
            if (ok) {
                const user = identity.user;
                return {
                    userId: providerUserId,
                    email: user.email,
                    phone: user.phone,
                    metadata: user,
                };
            }
        }

        throw new BadRequestException({
            message: 'Invalid or expired code',
            code: ERROR_CODES.VERIFICATION_CODE_INVALID,
        });
    }


    private async findIdentityForChannel(
        channel: 'email' | 'sms',
        identifier: string,
        tenantId?: string,
    ): Promise<{ identity: NestAuthIdentity; providerUserId: string } | null> {
        if (channel === 'email') {
            const providerUserId = normalizedEmail(identifier.trim());
            if (!providerUserId) {
                return null;
            }
            const identity = await this.authIdentityRepository.findOne({
                where: {
                    provider: EMAIL_AUTH_PROVIDER,
                    providerId: providerUserId,
                    ...(tenantId ? { user: { userAccesses: { tenantId: Equal(tenantId) } } } : {}),
                },
                relations: ['user'],
            });
            return identity ? { identity, providerUserId } : null;
        }

        const providerUserId = normalizedPhone(identifier.trim());
        if (!providerUserId) {
            return null;
        }
        const identity = await this.authIdentityRepository.findOne({
            where: {
                provider: PHONE_AUTH_PROVIDER,
                providerId: providerUserId,
                ...(tenantId ? { user: { userAccesses: { tenantId: Equal(tenantId) } } } : {}),
            },
            relations: ['user'],
        });
        return identity ? { identity, providerUserId } : null;
    }


    async findIdentity(providerUserId: string, tenantId?: string): Promise<NestAuthIdentity | null> {

        let found = await this.findIdentityForChannel('email', providerUserId, tenantId);
       
        if (found?.identity) {
            return found.identity;
        }
        
        found = await this.findIdentityForChannel('sms', providerUserId, tenantId);
        if (found?.identity) {
            return found.identity;
        }
        return null;
    }

    getRequiredFields(): string[] {
        return ['identifier', 'code', 'channels'];
    }

    /**
     * Find and validate an OTP of the given type; marks it used when valid.
     */
    private async consumeOtp(userId: string, type: NestAuthOTPTypeEnum, plainCode: string): Promise<boolean> {
        const candidates = await this.otpRepository.find({
            where: { userId, type },
            order: { createdAt: 'DESC' },
        });
        for (const otp of candidates) {
            if (await otp.validateCode(plainCode)) {
                await otp.remove();
                return true;
            }
        }
        return false;
    }
}
