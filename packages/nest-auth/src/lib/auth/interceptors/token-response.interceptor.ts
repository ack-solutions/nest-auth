import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { ACCESS_TOKEN_COOKIE_NAME, NEST_AUTH_TRUST_DEVICE_KEY, REFRESH_TOKEN_COOKIE_NAME } from '../../auth.constants';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import ms from 'ms';
import { omit } from 'lodash';
import { CookieHelper, CookieOptions } from '../../utils/cookie.helper';
import { DebugLoggerService } from '../../core/services/debug-logger.service';

@Injectable()
export class TokenResponseInterceptor implements NestInterceptor {

    private readonly options: IAuthModuleOptions;

    constructor(private readonly debugLogger: DebugLoggerService) {
        this.options = AuthConfigService.getOptions();
    }


    isUsingCookies(req: Request): boolean {
        const headerTokenType = req.headers['x-access-token-type'];
        if (!this.options.accessTokenType && headerTokenType === 'cookie') {
            this.debugLogger.debug(
                'Using cookies mode (from x-access-token-type header)',
                'TokenResponseInterceptor',
                { headerTokenType }
            );
            return true;
        } else if (this.options.accessTokenType === 'cookie') {
            this.debugLogger.debug(
                'Using cookies mode (from config)',
                'TokenResponseInterceptor',
                { configTokenType: this.options.accessTokenType }
            );
            return true;
        }
        this.debugLogger.debug(
            'Using header mode for tokens',
            'TokenResponseInterceptor',
            { configTokenType: this.options.accessTokenType, headerTokenType }
        );
        return false;
    }


    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {

        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request>();
        const res = ctx.getResponse<Response>();

        const isUsingCookies = await this.isUsingCookies(req);

        this.debugLogger.logFunctionEntry('intercept', 'TokenResponseInterceptor', {
            method: req.method,
            url: req.url,
            isUsingCookies
        });

        return next.handle().pipe(
            map(data => {
                if (!data) {
                    this.debugLogger.debug('No data to process', 'TokenResponseInterceptor');
                    return data;
                }

                if (isUsingCookies) {
                    this.debugLogger.debug(
                        'Setting tokens in cookies and removing from response body',
                        'TokenResponseInterceptor',
                        {
                            hasAccessToken: !!data.accessToken,
                            hasRefreshToken: !!data.refreshToken,
                            hasTrustToken: !!data.trustToken
                        }
                    );
                    this.setTokens(res, data);
                    // Remove tokens from response body
                    return omit(data, ['accessToken', 'refreshToken', 'trustToken']);
                }

                // Header Mode: Return data as is (tokens included in body)
                this.debugLogger.debug(
                    'Returning tokens in response body (header mode)',
                    'TokenResponseInterceptor',
                    {
                        hasAccessToken: !!data.accessToken,
                        hasRefreshToken: !!data.refreshToken
                    }
                );
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
            this.debugLogger.debug(
                `Setting access token cookie: ${ACCESS_TOKEN_COOKIE_NAME}`,
                'TokenResponseInterceptor'
            );
            this.setCookie(response, ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken);
        }
        if (tokens.refreshToken) {
            this.debugLogger.debug(
                `Setting refresh token cookie: ${REFRESH_TOKEN_COOKIE_NAME}`,
                'TokenResponseInterceptor'
            );
            this.setCookie(response, REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken);
        }
        if (tokens.trustToken) {
            const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
            const duration = AuthConfigService.getOptions().mfa?.trustedDeviceDuration || '30d';
            const maxAge = typeof duration === 'string' ? ms(duration) : duration;

            this.debugLogger.debug(
                `Setting trust device cookie: ${trustCookieName}`,
                'TokenResponseInterceptor',
                { duration, maxAge }
            );
            this.setCookie(response, trustCookieName, tokens.trustToken, {
                maxAge,
            });
        }
    }

    private setCookie(response: Response, name: string, token: string, options?: Partial<CookieOptions>): void {
        const cookieOptions = {
            httpOnly: true,
            path: '/',
            secure: this.options.cookieOptions?.secure,
            sameSite: this.options.cookieOptions?.sameSite as 'strict' | 'lax' | 'none' | undefined,
            maxAge: ms(this.options.session?.sessionExpiry || '7d'),
            ...options,
        };

        this.debugLogger.verbose(
            `Setting cookie: ${name}`,
            'TokenResponseInterceptor',
            {
                cookieName: name,
                httpOnly: cookieOptions.httpOnly,
                secure: cookieOptions.secure,
                sameSite: cookieOptions.sameSite,
                maxAge: cookieOptions.maxAge,
                path: cookieOptions.path
            }
        );

        // Use CookieHelper for consistent cookie handling
        CookieHelper.set(response, name, token, cookieOptions);
    }
}
