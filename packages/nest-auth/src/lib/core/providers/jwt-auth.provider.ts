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
        this.enabled = Boolean(this.jwtConfig);
    }

    async validate(credentials: SocialCredentialsDto, _tenantId?: string) {
        try {
            const payload = await this.jwtService.verifyToken(credentials.token);

            return {
                userId: payload.sub,
                email: payload.email,
                phone: payload.phone,
                metadata: {
                    ...payload,
                },
            };
        } catch (error) {
            throw new BadRequestException('Invalid JWT token');
        }
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
