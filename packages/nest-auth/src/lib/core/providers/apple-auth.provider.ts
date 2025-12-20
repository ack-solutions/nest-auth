import AppleAuth from 'apple-auth';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseAuthProvider } from './base-auth.provider';
import { APPLE_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { JwtService } from '../services/jwt.service';
import { AuthModuleOptions } from '../../core';

@Injectable()
export class AppleAuthProvider extends BaseAuthProvider {
    providerName = APPLE_AUTH_PROVIDER;
    skipMfa = true;
    private appleConfig: AuthModuleOptions['apple'];
    private appleAuth: AppleAuth;

    constructor(
        readonly dataSource: DataSource,
        private readonly jwtService: JwtService,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.appleConfig = this.options.apple;

        this.enabled = Boolean(this.options.apple);

        if (this.enabled) {
            this.appleAuth = new AppleAuth(
                {
                    scope: 'email name',
                    redirect_uri: this.appleConfig.redirectUri,
                    team_id: this.appleConfig.teamId,
                    key_id: this.appleConfig.keyId,
                    client_id: this.appleConfig.clientId,
                },
                this.appleConfig.privateKey,
                this.appleConfig.privateKeyMethod || 'text',
            );
        }
    }

    async validate(credentials: { token: string }) {
        try {
            const response = await this.appleAuth.accessToken(credentials.token);
            const user = this.jwtService.decodeToken(response.id_token);
            return {
                userId: user.id,
                email: user.email || '',
                metadata: user,
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid Apple token');
        }
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
