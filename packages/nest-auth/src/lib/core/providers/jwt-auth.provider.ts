import { BadRequestException } from '@nestjs/common';
import { BaseAuthProvider } from './base-auth.provider';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IAuthModuleOptions } from '../../core';
import { JWT_AUTH_PROVIDER } from '../../auth.constants';
import { JwtService } from '../services/jwt.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { SocialCredentialsDto } from 'src/lib/auth';

@Injectable()
export class JwtAuthProvider extends BaseAuthProvider {
    providerName = JWT_AUTH_PROVIDER;
    private jwtConfig: IAuthModuleOptions['jwt'];


    constructor(
        readonly dataSource: DataSource,
        private readonly jwtService: JwtService,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.jwtConfig = this.options.jwt;
        this.enabled = Boolean(this.jwtConfig);
    }

    async validate(credentials: SocialCredentialsDto) {
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
        return ['accessToken'];
    }
}
