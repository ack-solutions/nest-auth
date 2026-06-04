import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { JWTTokenPayload } from '../interfaces/token-payload.interface';
import ms from 'ms';
import { AuthConfigService } from './auth-config.service';


@Injectable()
export class JwtService {

    private options: IAuthModuleOptions;

    constructor() {
        this.options = AuthConfigService.getOptions();
    }

    async generateAccessToken(payload: Partial<JWTTokenPayload>): Promise<string> {
        return new Promise((resolve, reject) => {
            const jwtSecret = this.options.session?.jwt?.secret;
            if (!jwtSecret) {
                return reject(new Error('Missing session.jwt.secret'));
            }
            jwt.sign(
                {
                    ...payload,
                    type: 'access',
                },
                jwtSecret,
                {
                    expiresIn: this.options.session.accessTokenValidity,
                },
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async generateRefreshToken(payload: Partial<JWTTokenPayload>): Promise<string> {
        return new Promise((resolve, reject) => {
            const jwtSecret = this.options.session?.jwt?.secret;
            if (!jwtSecret) {
                return reject(new Error('Missing session.jwt.secret'));
            }
            jwt.sign(
                {
                    ...payload,
                    type: 'refresh',
                },
                jwtSecret,
                {
                    expiresIn: this.options.session.refreshTokenValidity,
                },
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async verifyToken(token: string): Promise<JWTTokenPayload> {
        return new Promise((resolve, reject) => {
            const jwtSecret = this.options.session?.jwt?.secret;
            if (!jwtSecret) {
                return reject(new Error('Missing session.jwt.secret'));
            }
            jwt.verify(
                token,
                jwtSecret,
                { algorithms: ['HS256'] },
                (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded as JWTTokenPayload);
                },
            );
        });
    }

    async generateTokens(payload: Partial<JWTTokenPayload>): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        const [accessToken, refreshToken] = await Promise.all([
            this.generateAccessToken(payload),
            this.generateRefreshToken(payload),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }

    updateToken(token: string, payload: Partial<JWTTokenPayload>): Promise<string> {
        return new Promise((resolve, reject) => {
            const decoded = this.decodeToken(token);
            if (!decoded) reject(new Error('Invalid token'));
            else {
                const jwtSecret = this.options.session?.jwt?.secret;
                if (!jwtSecret) {
                    return reject(new Error('Missing session.jwt.secret'));
                }
                jwt.sign({ ...decoded, ...payload }, jwtSecret, { expiresIn: this.options.session.accessTokenValidity }, (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                });
            }
        });
    }

    decodeToken(token: string): JWTTokenPayload | null {
        try {
            return jwt.decode(token) as JWTTokenPayload;
        } catch (error) {
            return null;
        }
    }

    getConfig(): IAuthModuleOptions {
        return this.options;
    }

    async generatePasswordResetToken(payload: { userId: string; passwordHashPrefix: string; type: string; tenantId?: string }): Promise<string> {
        return new Promise((resolve, reject) => {
            const expiresInRaw = this.options.password?.passwordResetTokenExpiresIn || '1h';
            // ms() returns MILLISECONDS, but a JWT `exp` claim is in SECONDS.
            // The previous code added milliseconds to a seconds timestamp, making
            // reset tokens valid for ~41 days. Convert to seconds; accept a numeric
            // (already-seconds) config value as-is.
            const expiresInSec = typeof expiresInRaw === 'number'
                ? expiresInRaw
                : Math.floor((ms(expiresInRaw) as number) / 1000);
            const jwtSecret = this.options.session?.jwt?.secret;
            if (!jwtSecret) {
                return reject(new Error('Missing session.jwt.secret'));
            }
            jwt.sign(
                {
                    ...payload,
                    exp: Math.floor(Date.now() / 1000) + expiresInSec,
                    iat: Math.floor(Date.now() / 1000),
                },
                jwtSecret,
                { algorithm: 'HS256' },
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async verifyPasswordResetToken(token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const jwtSecret = this.options.session?.jwt?.secret;
            if (!jwtSecret) {
                return reject(new Error('Missing session.jwt.secret'));
            }
            jwt.verify(
                token,
                jwtSecret,
                { algorithms: ['HS256'] },
                (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded);
                },
            );
        });
    }
}
