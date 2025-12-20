import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseAuthProvider } from './base-auth.provider';
import { AuthModuleOptions } from '../../core';
import { GOOGLE_AUTH_PROVIDER } from '../../auth.constants';
import { DataSource } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';

@Injectable()
export class GoogleAuthProvider extends BaseAuthProvider {
    providerName = GOOGLE_AUTH_PROVIDER;
    skipMfa = true;
    private client: OAuth2Client;
    private googleConfig: AuthModuleOptions['google'];

    constructor(
        readonly dataSource: DataSource,
    ) {
        const userRepository = dataSource.getRepository(NestAuthUser);
        const authIdentityRepository = dataSource.getRepository(NestAuthIdentity);

        super(userRepository, authIdentityRepository);

        this.googleConfig = this.options.google;
        this.enabled = Boolean(this.googleConfig);
        if (this.enabled) {
            this.client = new OAuth2Client(this.googleConfig.clientId, this.googleConfig.clientSecret);
        }
    }


    /**
     * Validate Google credentials.
     * Supports validation via 'idToken' or 'accessToken'.
     *
     * @param credentials - Object containing either 'idToken' or 'accessToken'
     * @returns AuthProviderUser - Validated user user info
     */
    async validate(credentials: { token: string, type: 'id' | 'access' }) {
        const { token, type = 'id' } = credentials;
        let payload: TokenPayload
        if (type === 'id') {
            // CASE 1: Validation via ID Token
            // Recommended for backend verification as it's stateless and secure.
            try {
                const ticket = await this.client.verifyIdToken({
                    idToken: token,
                    audience: this.googleConfig.clientId,
                });

                payload = ticket.getPayload();
            } catch (error) {
                console.error('Google ID Token validation failed:', error);
                throw new UnauthorizedException('Invalid Google ID token');
            }
            // CASE 2: ACCESS TOKEN
        } else if (type === 'access') {
            try {
                // 1) Basic validation
                const tokenInfo = await this.client.getTokenInfo(token);

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
                } as any as TokenPayload;
            } catch (error) {
                console.error('Google Access Token validation failed:', error);
                throw new UnauthorizedException('Invalid Google Access token');
            }


        } else {
            throw new UnauthorizedException(
                'Missing or invalid Google token type (id | access) in credentials',
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
