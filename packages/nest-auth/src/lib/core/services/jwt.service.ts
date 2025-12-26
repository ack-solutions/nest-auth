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
            jwt.sign(
                {
                    ...payload,
                    type: 'access',
                    exp: Math.floor(Date.now() / 1000) + ms(this.options.session.sessionExpiry),
                    iat: Math.floor(Date.now() / 1000),
                },
                this.options.jwt.secret,
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async generateRefreshToken(payload: Partial<JWTTokenPayload>): Promise<string> {
        return new Promise((resolve, reject) => {
            jwt.sign(
                {
                    ...payload,
                    type: 'refresh',
                    exp: Math.floor(Date.now() / 1000) + ms(this.options.session.refreshTokenExpiry),
                    iat: Math.floor(Date.now() / 1000),
                },
                this.options.jwt.secret,
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async verifyToken(token: string): Promise<JWTTokenPayload> {
        return new Promise((resolve, reject) => {
            jwt.verify(
                token,
                this.options.jwt.secret,
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
                jwt.sign({ ...decoded, ...payload }, this.options.jwt.secret, { expiresIn: this.options.session.sessionExpiry }, (err, token) => {
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

    async generatePasswordResetToken(payload: { userId: string; passwordHashPrefix: string; type: string }): Promise<string> {
        return new Promise((resolve, reject) => {
            const expiresIn = this.options.passwordResetTokenExpiresIn || '1h';
            jwt.sign(
                {
                    ...payload,
                    exp: Math.floor(Date.now() / 1000) + ms(expiresIn),
                    iat: Math.floor(Date.now() / 1000),
                },
                this.options.jwt.secret,
                (err, token) => {
                    if (err) reject(err);
                    else resolve(token);
                },
            );
        });
    }

    async verifyPasswordResetToken(token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            jwt.verify(
                token,
                this.options.jwt.secret,
                (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded);
                },
            );
        });
    }
}
