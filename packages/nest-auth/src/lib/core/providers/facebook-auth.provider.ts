import Facebook from 'fb';
import { BaseAuthProvider } from './base-auth.provider';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FACEBOOK_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { AuthModuleOptions } from '../interfaces/auth-module-options.interface';

@Injectable()
export class FacebookAuthProvider extends BaseAuthProvider {
    providerName = FACEBOOK_AUTH_PROVIDER;
    skipMfa = true;
    private facebookConfig: AuthModuleOptions['facebook'];

    constructor(
        readonly dataSource: DataSource,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.facebookConfig = this.options.facebook;
        this.enabled = Boolean(this.facebookConfig);

        if (this.enabled) {
            Facebook.options({
                appId: this.facebookConfig.appId,
                appSecret: this.facebookConfig.appSecret,
            });
        }
    }

    async validate(credentials: { token: string }) {
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
