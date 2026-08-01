import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseAuthProvider } from './base-auth.provider';
import { IAuthModuleOptions } from '../../core';
import { JWT_AUTH_PROVIDER } from '../../auth.constants';
import { JwtService } from '../services/jwt.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { SocialCredentialsDto } from '../../auth/dto/credentials/social-credentials.dto';
import { SessionOptions } from '../interfaces/session-options.interface';

@Injectable()
export class JwtAuthProvider extends BaseAuthProvider {
    providerName = JWT_AUTH_PROVIDER;
    private jwtConfig: SessionOptions['jwt'];


    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
        private readonly jwtService: JwtService,
    ) {
        super(userRepository, authIdentityRepository);

        this.jwtConfig = this.options.session?.jwt;
        // Opt-in only (see AuthProviderRegistryService): a trust-any-signed-token
        // login path must be enabled deliberately, never by the mere presence of
        // a signing secret.
        this.enabled = this.jwtConfig?.enableLoginProvider === true;
    }

    async validate(credentials: SocialCredentialsDto, _tenantId?: string) {
        let payload;
        try {
            payload = await this.jwtService.verifyToken(credentials.token);
        } catch (error) {
            throw new BadRequestException('Invalid JWT token');
        }

        // Defense in depth: reject SESSION tokens here so an internally-issued
        // access/refresh token (same signing key) can't be laundered into a fresh
        // session via this provider. A caller must mint a purpose-built token.
        if (payload?.type === 'access' || payload?.type === 'refresh') {
            throw new BadRequestException('Session tokens are not accepted by the jwt login provider');
        }

        return {
            userId: payload.sub,
            email: payload.email,
            phone: payload.phone,
            metadata: {
                ...payload,
            },
        };
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
