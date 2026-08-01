// `import type` is fully erased at compile time, so it does NOT emit a
// top-level `require('apple-auth')`. The optional `apple-auth` peer is only
// pulled in lazily (see the constructor) when the web authorization-code flow
// is actually configured — apps using native identityToken verification, or no
// Apple at all, can boot without the package installed.
import type AppleAuth from 'apple-auth';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPublicKey, type KeyObject } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { BaseAuthProvider } from './base-auth.provider';
import { APPLE_AUTH_PROVIDER, ERROR_CODES } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { JwtService } from '../services/jwt.service';
import { IAuthModuleOptions } from '../../core';
import { SocialCredentialsDto } from '../../auth/dto/credentials/social-credentials.dto';

const APPLE_ISSUER = 'https://appleid.apple.com';
const DEFAULT_APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_TTL_MS = 10 * 60 * 1000;

/**
 * Apple authentication provider.
 *
 * Accepts EITHER:
 *  - a **native** `identityToken` (from `expo-apple-authentication`,
 *    `@invertase/react-native-apple-authentication`, or Flutter
 *    `sign_in_with_apple`) — verified offline against Apple's JWKS. This is the
 *    browser-free path for mobile apps.
 *  - an **authorization code** (web "Sign in with Apple JS") — exchanged
 *    server-side for an id_token. Requires `teamId`/`keyId`/`privateKey`.
 *
 * The path is auto-detected from the token's issuer, so callers just pass
 * whatever the SDK gave them.
 */
@Injectable()
export class AppleAuthProvider extends BaseAuthProvider {
    providerName = APPLE_AUTH_PROVIDER;
    skipMfa = true;
    private appleConfig: IAuthModuleOptions['apple'];
    private appleAuth?: AppleAuth;
    private jwksCache?: { keys: any[]; fetchedAt: number };

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
        private readonly jwtService: JwtService,
    ) {
        super(userRepository, authIdentityRepository);

        this.appleConfig = this.options.apple;
        this.enabled = Boolean(this.options.apple);

        // The web authorization-code exchange needs the Apple private key. A
        // native-only deployment (mobile identityToken verification) can skip it.
        if (
            this.enabled &&
            this.appleConfig?.privateKey &&
            this.appleConfig?.teamId &&
            this.appleConfig?.keyId
        ) {
            // Lazy-load the optional `apple-auth` peer only now that the web
            // authorization-code flow is confirmed configured.
            let AppleAuthCtor: any;
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require('apple-auth');
                AppleAuthCtor = mod?.default ?? mod;
            } catch {
                throw new Error(
                    'Apple "Sign in with Apple JS" authorization-code exchange requires the optional "apple-auth" package. Install it (e.g. `npm i apple-auth`), or send a native identityToken instead.',
                );
            }
            this.appleAuth = new AppleAuthCtor(
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

    async validate(credentials: SocialCredentialsDto) {
        const token = credentials?.token;
        if (!token) {
            throw new UnauthorizedException({
                message: 'Missing Apple token',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        // Inspect the token to choose the path. A native identityToken is a JWT
        // issued by Apple; a web authorization code is an opaque string.
        const decoded = this.safeDecode(token);
        const isIdentityToken = decoded?.payload?.iss === APPLE_ISSUER;

        if (isIdentityToken) {
            return this.verifyIdentityToken(token, decoded!.header, credentials);
        }
        return this.exchangeAuthorizationCode(token, credentials);
    }

    getRequiredFields(): string[] {
        return ['token'];
    }

    // -- Native: verify an Apple identityToken against Apple's JWKS ------------

    private async verifyIdentityToken(
        token: string,
        header: { kid?: string; alg?: string },
        credentials: SocialCredentialsDto,
    ) {
        const audiences = this.appleConfig?.audiences?.length
            ? this.appleConfig.audiences
            : [this.appleConfig?.clientId].filter(Boolean) as string[];

        if (audiences.length === 0) {
            throw new UnauthorizedException({
                message: 'Apple audiences are not configured',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        const publicKey = await this.getApplePublicKey(header?.kid);

        let payload: any;
        try {
            payload = jwt.verify(token, publicKey, {
                algorithms: ['RS256'],
                // Non-empty: guarded by the length check above.
                audience: audiences as [string, ...string[]],
                issuer: APPLE_ISSUER,
            });
        } catch (error) {
            throw new UnauthorizedException({
                message: 'Invalid Apple identity token',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        // Replay protection: if the caller supplied a nonce, it must match.
        if (credentials.nonce && payload.nonce !== credentials.nonce) {
            throw new UnauthorizedException({
                message: 'Apple nonce mismatch',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        const emailVerified =
            payload.email_verified === true || payload.email_verified === 'true';

        return {
            userId: payload.sub,
            email: payload.email || '',
            // Top-level so the auth service can gate account-linking / lift
            // emailVerifiedAt (kept in metadata too for backward compatibility).
            emailVerified,
            metadata: {
                ...payload,
                name: credentials.name,
                emailVerified,
            },
        };
    }

    private async getApplePublicKey(kid?: string): Promise<KeyObject> {
        const jwk = await this.findJwk(kid);
        if (!jwk) {
            throw new UnauthorizedException({
                message: 'Apple signing key not found',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }
        return createPublicKey({ key: jwk as any, format: 'jwk' });
    }

    private async findJwk(kid?: string): Promise<any | undefined> {
        const fresh = this.jwksCache && Date.now() - this.jwksCache.fetchedAt < JWKS_TTL_MS;
        if (!fresh) {
            await this.refreshJwks();
        }
        let jwk = this.jwksCache?.keys.find((k) => k.kid === kid);
        if (!jwk && fresh) {
            // Keys may have rotated since our cached copy — refetch once.
            await this.refreshJwks();
            jwk = this.jwksCache?.keys.find((k) => k.kid === kid);
        }
        return jwk;
    }

    private async refreshJwks(): Promise<void> {
        const url = this.appleConfig?.jwksUrl || DEFAULT_APPLE_JWKS_URL;
        let res: Response;
        try {
            res = await fetch(url);
        } catch (error) {
            throw new UnauthorizedException({
                message: 'Could not reach Apple to verify the token',
                code: 'OAUTH_PROVIDER_ERROR',
            });
        }
        if (!res.ok) {
            throw new UnauthorizedException({
                message: 'Apple key endpoint returned an error',
                code: 'OAUTH_PROVIDER_ERROR',
            });
        }
        const json: any = await res.json();
        this.jwksCache = { keys: json.keys ?? [], fetchedAt: Date.now() };
    }

    // -- Web: exchange an authorization code for an id_token -------------------

    private async exchangeAuthorizationCode(
        code: string,
        credentials: SocialCredentialsDto,
    ) {
        if (!this.appleAuth) {
            throw new UnauthorizedException({
                message:
                    'Apple authorization-code exchange is not configured (set apple.teamId/keyId/privateKey), or pass a native identityToken instead.',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }
        try {
            const response = await this.appleAuth.accessToken(code);
            const user = this.jwtService.decodeToken(response.id_token) as any;
            return {
                // Apple id_tokens identify the user by `sub`, not `id`.
                userId: user.sub,
                email: user.email || '',
                // This id_token is decoded but not signature-verified here, so its
                // claims can't be trusted for auto-linking — report unverified.
                emailVerified: false,
                metadata: { ...user, name: credentials.name },
            };
        } catch (error) {
            throw new UnauthorizedException({
                message: 'Invalid Apple token',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }
    }

    private safeDecode(token: string): { header: any; payload: any } | null {
        try {
            return jwt.decode(token, { complete: true }) as { header: any; payload: any } | null;
        } catch {
            return null;
        }
    }
}
