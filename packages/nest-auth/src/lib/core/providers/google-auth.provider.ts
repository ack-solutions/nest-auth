import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseAuthProvider } from './base-auth.provider';
import { IAuthModuleOptions } from '../../core';
import { GOOGLE_AUTH_PROVIDER } from '../../auth.constants';
import { DataSource } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { SocialCredentialsDto } from 'src/lib/auth';

@Injectable()
export class GoogleAuthProvider extends BaseAuthProvider {
    providerName = GOOGLE_AUTH_PROVIDER;
    skipMfa = true;
    private googleConfig: IAuthModuleOptions['google'];

    constructor(
        readonly dataSource: DataSource,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.googleConfig = this.options.google;
        this.enabled = Boolean(this.googleConfig);
    }

    private getClient(clientId: string, clientSecret: string) {
        try {
            const { OAuth2Client } = require('google-auth-library');
            return new OAuth2Client(clientId, clientSecret);
        } catch (error) {
            console.error('Failed to load google-auth-library. Please install it to use Google Auth.', error);
            throw new Error('Google Auth dependency missing: google-auth-library');
        }
    }

    /**
     * Validate Google credentials.
     * Supports validation via 'idToken' or 'accessToken'.
     *
     * @param credentials - Object containing either 'idToken' or 'accessToken'
     * @param config - Optional configuration override
     * @returns AuthProviderUser - Validated user user info
     */
    async validate(credentials: SocialCredentialsDto) {
        const currentConfig = this.googleConfig;

        if (!currentConfig) {
            throw new UnauthorizedException('Google authentication is not configured');
        }

        const { token } = credentials;
        const type = credentials.type || 'idToken';

        // Lazy load client
        const client = this.getClient(currentConfig.clientId, currentConfig.clientSecret);

        let payload: any; // TokenPayload
        if (type === 'idToken') {
            // CASE 1: Validation via ID Token
            // Recommended for backend verification as it's stateless and secure.
            try {
                const ticket = await client.verifyIdToken({
                    idToken: token,
                    audience: currentConfig.clientId,
                });

                payload = ticket.getPayload();
            } catch (error) {
                console.error('Google ID Token validation failed:', error);
                throw new UnauthorizedException('Invalid Google ID token');
            }
            // CASE 2: ACCESS TOKEN
        } else if (type === 'accessToken') {
            try {
                // 1) Basic validation
                const tokenInfo = await client.getTokenInfo(token);

                // Optional / depends on scopes; don’t *assume* email_verified exists
                // if ((tokenInfo as any).email_verified === false) {
                //   throw new UnauthorizedException('Google email not verified');
                // }

                // 2) Fetch profile from userinfo endpoint (use plain fetch/axios)
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    console.error('userinfo error status:', res.status, await res.text());
                    throw new UnauthorizedException('Failed to fetch Google user info');
                }

                const userInfo = (await res.json()) as any;

                payload = {
                    ...userInfo,
                    sub: tokenInfo.sub ?? userInfo.sub,
                    email: userInfo.email ?? tokenInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    locale: userInfo.locale,
                };
            } catch (error) {
                console.error('Google Access Token validation failed:', error);
                throw new UnauthorizedException('Invalid Google Access token');
            }


        } else {
            throw new UnauthorizedException(
                'Missing or invalid Google token type (idToken | accessToken) in credentials',
            );
        }

        if (!payload || !payload.sub) {
            throw new UnauthorizedException(`Invalid Google ${type} token`);
        }

        return {
            userId: payload.sub,
            email: payload.email || '',
            metadata: {
                name: payload.name,
                picture: payload.picture,
                locale: payload.locale,
            },
        };
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
