import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FACEBOOK_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { BaseAuthProvider } from './base-auth.provider';
import { SocialCredentialsDto } from 'src/lib/auth';

@Injectable()
export class FacebookAuthProvider extends BaseAuthProvider {
    providerName = FACEBOOK_AUTH_PROVIDER;
    skipMfa = true;
    private facebookConfig: IAuthModuleOptions['facebook'];

    constructor(
        readonly dataSource: DataSource,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.facebookConfig = this.options.facebook;
        this.enabled = Boolean(this.facebookConfig);
    }

    async validate(credentials: SocialCredentialsDto) {
        let Facebook: any;
        try {
            Facebook = require('fb');
        } catch (error) {
            console.error('Failed to load fb. Please install it to use Facebook Auth.', error);
            throw new Error('Facebook Auth dependency missing: fb');
        }

        const currentConfig = this.facebookConfig;

        if (!currentConfig) {
            throw new UnauthorizedException('Facebook authentication is not configured');
        }

        Facebook.options({
            appId: currentConfig.appId,
            appSecret: currentConfig.appSecret,
        });

        try {
            const response = await Facebook.api('me', {
                fields: ['id', 'email', 'name', 'picture'],
                access_token: credentials.token,
            });

            return {
                userId: response.id,
                email: response.email || '',
                metadata: {
                    name: response.name,
                    picture: response.picture?.data?.url,
                },
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid Facebook token');
        }
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
