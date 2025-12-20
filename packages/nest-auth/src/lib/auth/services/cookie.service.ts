import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../../auth.constants';
import { AuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import ms from 'ms';
import { AuthConfigService } from '../../core/services/auth-config.service';

@Injectable()
export class CookieService {
    private options: AuthModuleOptions;

    constructor() {
        this.options = AuthConfigService.getOptions();
    }

    setAccessTokenCookie(response: Response, token: string): void {
        response.cookie(ACCESS_TOKEN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: this.options.cookieOptions.secure,
            sameSite: this.options.cookieOptions.sameSite,
            maxAge: ms(this.options.session.sessionExpiry),
        });
    }

    setRefreshTokenCookie(response: Response, token: string): void {
        response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: this.options.cookieOptions.secure,
            sameSite: this.options.cookieOptions.sameSite,
            maxAge: ms(this.options.session.refreshTokenExpiry),
        });
    }

    clearCookies(response: Response): void {
        response.clearCookie(ACCESS_TOKEN_COOKIE_NAME);
        response.clearCookie(REFRESH_TOKEN_COOKIE_NAME);
    }

    setTokens(response: Response, accessToken: string, refreshToken: string): void {
        this.setAccessTokenCookie(response, accessToken);
        this.setRefreshTokenCookie(response, refreshToken);
    }
}
