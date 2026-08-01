import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseAuthProvider } from './base-auth.provider';
import { IAuthModuleOptions } from '../../core';
import { GOOGLE_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { SocialCredentialsDto } from '../../auth/dto/credentials/social-credentials.dto';

@Injectable()
export class GoogleAuthProvider extends BaseAuthProvider {
    providerName = GOOGLE_AUTH_PROVIDER;
    skipMfa = true;
    private googleConfig: IAuthModuleOptions['google'];

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
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
     *
     * Supports two token kinds, selected by `credentials.type`:
     * - `'idToken'` (default) — JWT signed by Google, verified offline against
     *   Google's public keys with `audience` pinned to the configured clientId.
     * - `'accessToken'` — OAuth 2.0 bearer; validated via `getTokenInfo`, then
     *   userinfo is fetched from `https://www.googleapis.com/oauth2/v3/userinfo`.
     *
     * @param credentials - Object containing `token` and optional `type`.
     * @param _tenantId   - Tenant context, unused (Google identities are global
     *                      by `sub`; tenant assignment happens later in the auth
     *                      flow via UserAccess, not at provider validation time).
     * @returns The resolved provider user (`{ userId, email, metadata }`).
     */
    async validate(credentials: SocialCredentialsDto, _tenantId?: string) {
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
                    // Accept the web client ID plus any extra audiences (e.g. the
                    // native iOS/Android client IDs) so one backend serves every
                    // platform's Google Sign-In.
                    audience: [currentConfig.clientId, ...(currentConfig.audiences ?? [])],
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
                    // userinfo's `email_verified` is more reliable than tokenInfo's
                    email_verified:
                        (userInfo as any).email_verified ?? (tokenInfo as any).email_verified,
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

        // Strict email-verified gate. We only enforce when the field is
        // explicitly `false` — missing means "Google didn't tell us", which
        // is the original concern that motivated commenting this out.
        if (
            currentConfig.requireVerifiedEmail &&
            (payload as any).email_verified === false
        ) {
            throw new UnauthorizedException('Google reports this email as unverified');
        }

        return {
            userId: payload.sub,
            email: payload.email || '',
            // Pass through Google's verification claim so the auth flow can
            // promote `emailVerifiedAt` on the user. Google's idToken almost
            // always carries this; access-token flows may not.
            emailVerified: (payload as any).email_verified === true,
            metadata: {
                name: payload.name,
                picture: payload.picture,
                locale: payload.locale,
                ...this.profileOverridesFromCredentials(credentials),
            },
        };
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}
