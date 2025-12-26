import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CookieOptions, Request, Response } from 'express';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { ACCESS_TOKEN_COOKIE_NAME, NEST_AUTH_TRUST_DEVICE_KEY, REFRESH_TOKEN_COOKIE_NAME } from '../../auth.constants';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import ms from 'ms';
import { omit } from 'lodash';

@Injectable()
export class TokenResponseInterceptor implements NestInterceptor {

    private readonly options: IAuthModuleOptions;

    constructor() {
        this.options = AuthConfigService.getOptions();
    }


    isUsingCookies(req: Request): boolean {
        if (!this.options.accessTokenType && req.headers['x-access-token-type'] === 'cookie') {
            return true;
        } else if (this.options.accessTokenType === 'cookie') {
            return true;
        }
        return false;
    }


    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {

        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request>();
        const res = ctx.getResponse<Response>();

        const isUsingCookies = await this.isUsingCookies(req);

        return next.handle().pipe(
            map(data => {
                if (!data) return data;

                if (isUsingCookies) {
                    this.setTokens(res, data);
                    // Remove tokens from response body
                    return omit(data, ['accessToken', 'refreshToken', 'trustToken']);
                }

                // Header Mode: Return data as is (tokens included in body)
                return data;
            }),
        );
    }

    setTokens(response: Response, tokens: {
        accessToken?: string,
        refreshToken?: string,
        trustToken?: string
    }): void {
        if (tokens.accessToken) {
            this.setCookie(response, ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken);
        }
        if (tokens.refreshToken) {
            this.setCookie(response, REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken);
        }
        if (tokens.trustToken) {
            const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
            const duration = AuthConfigService.getOptions().mfa?.trustedDeviceDuration || '30d';
            const maxAge = typeof duration === 'string' ? ms(duration) : duration;

            this.setCookie(response, trustCookieName, tokens.trustToken, {
                maxAge,
            });
        }
    }

    private setCookie(response: Response, name, token: string, options?: CookieOptions): void {
        response.cookie(name, token, {
            httpOnly: true,
            path: '/',
            secure: this.options.cookieOptions.secure,
            sameSite: this.options.cookieOptions.sameSite,
            maxAge: ms(this.options.session.sessionExpiry),
            ...options,
        });
    }
}
