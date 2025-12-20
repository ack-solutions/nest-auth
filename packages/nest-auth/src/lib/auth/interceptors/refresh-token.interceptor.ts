import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { CookieService } from '../services/cookie.service';
import { JwtService } from '../../core/services/jwt.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { REFRESH_TOKEN_COOKIE_NAME, UNAUTHORIZED_EXCEPTION_CODE } from '../../auth.constants';

/**
 * RefreshTokenInterceptor
 *
 * Automatically handles token refresh when access token is expired.
 * This interceptor runs before guards and catches token expiration errors,
 * attempting to refresh the token transparently.
 *
 * Token delivery method (header vs cookie) respects the `accessTokenType` configuration:
 * - If `accessTokenType: 'header'` (default): Updates Authorization header only
 * - If `accessTokenType: 'cookie'`: Sets tokens in cookies
 *
 * Apply this globally to handle token refresh across your entire application.
 *
 * @example
 * ```typescript
 * // In AppModule or NestAuthModule configuration
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: RefreshTokenInterceptor,
 *   },
 * ]
 * ```
 */
@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
    constructor(
        private readonly authService: AuthService,
        private readonly cookieService: CookieService,
        private readonly jwtService: JwtService,
        private readonly authConfig: AuthConfigService,
    ) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Extract access token from Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No bearer token, proceed normally
            return next.handle();
        }

        const accessToken = authHeader.split(' ')[1];
        if (!accessToken) {
            return next.handle();
        }

        // Try to verify the access token
        try {
            await this.jwtService.verifyToken(accessToken);
            // Token is valid, proceed normally
            return next.handle();
        } catch (error) {
            // Token is invalid or expired, try to refresh
            const refreshToken = this.extractRefreshToken(request);

            if (!refreshToken) {
                // No refresh token available, let the guard handle it
                return next.handle();
            }

            try {
                // Attempt to refresh the token
                const newSession = await this.authService.refreshToken(refreshToken);

                // Get auth configuration
                const config = this.authConfig.getConfig();
                const useCookies = config.accessTokenType === 'cookie';

                if (useCookies) {
                    // Cookie-based auth: Set tokens in cookies
                    this.cookieService.setTokens(response, newSession.accessToken, newSession.refreshToken);
                } else {
                    // Header-based auth (default): Update Authorization header only
                    request.headers.authorization = `Bearer ${newSession.accessToken}`;
                }

                // Proceed with the new token
                return next.handle();
            } catch (refreshError) {
                // Refresh failed, let the guard handle the authentication failure
                return next.handle();
            }
        }
    }

    /**
     * Extract refresh token from cookies or headers
     */
    private extractRefreshToken(request: Request): string | null {
        // Try to get refresh token from cookies
        const tokenFromCookie = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
        if (tokenFromCookie) {
            return tokenFromCookie;
        }

        // If not in cookies, try the custom header
        const authHeader = request.headers['x-refresh-token'];
        if (authHeader) {
            return authHeader as string;
        }

        return null;
    }
}
