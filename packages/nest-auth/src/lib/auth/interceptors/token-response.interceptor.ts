import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuthConfigService } from '../../core/services/auth-config.service';
import {
    ACCESS_TOKEN_COOKIE_NAME,
    NEST_AUTH_TRUST_DEVICE_KEY,
    REFRESH_TOKEN_COOKIE_NAME,
    ACTIVE_ACCOUNT_COOKIE_NAME,
    REMEMBER_COOKIE_NAME,
    accountAccessCookieName,
    accountRefreshCookieName,
    userIdFromJwt,
} from '../../auth.constants';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import ms from 'ms';
import { omit } from 'lodash';
import { CookieHelper, CookieOptions } from '../../utils/cookie.helper';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { CsrfService } from '../../core/services/csrf.service';

@Injectable()
export class TokenResponseInterceptor implements NestInterceptor {

    // Lazy — never capture options at construction (they'd be stale under
    // forRootAsync; see JwtService). getOptions() is a cheap static read.
    private get options(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    constructor(
        private readonly debugLogger: DebugLoggerService,
        private readonly csrfService: CsrfService,
    ) { }


    isUsingCookies(req: Request): boolean {
        const headerTokenType = req.headers['x-access-token-type'];
        const accessTokenType = this.options.session?.accessTokenType ?? null;
        if (!accessTokenType && headerTokenType === 'cookie') {
            this.debugLogger.debug(
                'Using cookies mode (from x-access-token-type header)',
                'TokenResponseInterceptor',
                { headerTokenType }
            );
            return true;
        } else if (accessTokenType === 'cookie') {
            this.debugLogger.debug(
                'Using cookies mode (from config)',
                'TokenResponseInterceptor',
                { configTokenType: accessTokenType }
            );
            return true;
        }
        this.debugLogger.debug(
            'Using header mode for tokens',
            'TokenResponseInterceptor',
            { configTokenType: accessTokenType, headerTokenType }
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
                    this.setTokens(res, data, this.resolvePersistent(req));
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

    /**
     * Whether the cookies for this response should persist across browser close.
     * Honours an explicit `rememberMe` on the login body, then falls back to the
     * sticky marker cookie (set on a prior non-persistent login) so token
     * refreshes don't silently upgrade a "don't remember me" session. Default: persist.
     */
    private resolvePersistent(req: Request): boolean {
        const body = (req as any).body;
        if (body && typeof body.rememberMe === 'boolean') {
            return body.rememberMe;
        }
        return CookieHelper.get(req, REMEMBER_COOKIE_NAME) !== '0';
    }

    setTokens(response: Response, tokens: {
        accessToken?: string,
        refreshToken?: string,
        trustToken?: string
    }, persistent: boolean = true): void {
        const accessDuration =  this.options.session?.accessTokenValidity;
        const refreshDuration = this.options.session?.refreshTokenValidity;
        // "Remember me": when NOT persistent, omit maxAge so the auth cookies are
        // SESSION cookies (cleared when the browser closes). The choice is made
        // sticky across token refresh by the marker cookie written below.
        const accessMaxAge = persistent ? ms(accessDuration) : undefined;
        const refreshMaxAge = persistent ? ms(refreshDuration) : undefined;

        // Multi-account (cookie mode): write per-account cookies keyed by the
        // user id, plus a non-httpOnly selector naming the active account. This
        // lets one browser hold several accounts' httpOnly tokens at once and
        // switch which is active client-side. Single-account mode is unchanged.
        const multiAccount = this.options.session?.allowMultipleAccounts === true;
        const accountKey = multiAccount
            ? userIdFromJwt(tokens.accessToken || tokens.refreshToken || '')
            : undefined;
        const accessName = accountKey ? accountAccessCookieName(accountKey) : ACCESS_TOKEN_COOKIE_NAME;
        const refreshName = accountKey ? accountRefreshCookieName(accountKey) : REFRESH_TOKEN_COOKIE_NAME;

        if (tokens.accessToken) {
            this.setCookie(response, accessName, tokens.accessToken, {
                maxAge: accessMaxAge,
            });
        }
        if (tokens.refreshToken) {
            this.setCookie(response, refreshName, tokens.refreshToken, {
                maxAge: refreshMaxAge,
            });
        }
        if (accountKey) {
            // The selector is readable by JS so the SDK can switch accounts
            // without a round-trip; it only NAMES which of the user's own token
            // cookies to use (not a credential), so httpOnly is intentionally off.
            this.setCookie(response, ACTIVE_ACCOUNT_COOKIE_NAME, accountKey, {
                httpOnly: false,
                maxAge: refreshMaxAge,
            });
        }
        if (tokens.trustToken) {
            const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
            const duration = AuthConfigService.getOptions().mfa?.trustedDeviceDuration || '30d';
            this.setCookie(response, trustCookieName, tokens.trustToken, {
                maxAge: ms(duration),
            });
        }

        // Issue (rotate) the double-submit CSRF token alongside the session
        // cookies whenever CSRF is enabled, so the SPA always has a fresh token to
        // echo. Non-httpOnly (handled by CsrfService.issue), but same transport
        // flags as the auth cookies.
        if (this.csrfService.isEnabled()) {
            this.csrfService.issue(response, {
                secure: this.options.session?.cookieOptions?.secure ?? true,
                sameSite: (this.options.session?.cookieOptions?.sameSite ?? 'lax') as CookieOptions['sameSite'],
                ...(this.options.session?.cookieOptions?.domain ? { domain: this.options.session.cookieOptions.domain } : {}),
                path: '/',
                maxAge: refreshMaxAge,
            });
        }

        // Make the "remember me" choice sticky across refresh: when the login
        // opted out of persistence, drop a SESSION-scoped marker so the next
        // /refresh-token keeps issuing session cookies; otherwise clear it.
        if (persistent) {
            CookieHelper.delete(response, REMEMBER_COOKIE_NAME, { path: '/' });
        } else {
            this.setCookie(response, REMEMBER_COOKIE_NAME, '0', { maxAge: undefined });
        }

        // Do NOT log raw token values, even at debug level.
        this.debugLogger.debug('Setting tokens in cookies', 'TokenResponseInterceptor', {
            hasAccessToken: !!tokens.accessToken,
            hasRefreshToken: !!tokens.refreshToken,
            accessDuration,
            refreshDuration,
        });

    }

    private setCookie(response: Response, name: string, token: string, options?: Partial<CookieOptions>): void {
        const cookieOptions = {
            httpOnly: true,
            path: '/',
            // Secure by default — auth/refresh tokens must not ride plaintext HTTP.
            // Integrators can explicitly set cookieOptions.secure = false for local dev.
            secure: this.options.session?.cookieOptions?.secure ?? true,
            ...this.options.session?.cookieOptions?.domain ? { domain: this.options.session?.cookieOptions?.domain } : {},
            sameSite: (this.options.session?.cookieOptions?.sameSite ?? 'lax') as 'strict' | 'lax' | 'none' | undefined,
            maxAge: ms(this.options.session?.accessTokenValidity || '7d'),
            ...options,
        };

        this.debugLogger.verbose(
            `Setting cookie: ${name}`,
            'TokenResponseInterceptor',
            {
                cookieName: name,
                ...cookieOptions
            }
        );

        // Use CookieHelper for consistent cookie handling
        CookieHelper.set(response, name, token, cookieOptions);
    }
}
