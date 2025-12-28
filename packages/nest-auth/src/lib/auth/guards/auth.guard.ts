import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ERROR_CODES, OPTIONAL_AUTH_KEY } from '../../auth.constants';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { JwtService } from '../../core/services/jwt.service';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { AccessKeyService } from '../../user/services/access-key.service';
import { JWTTokenPayload } from '../../core/interfaces/token-payload.interface';
import { SKIP_MFA_KEY } from '../../core/decorators/skip-mfa.decorator';
import { PERMISSIONS_KEY } from '../../core/decorators/permissions.decorator';
import { ROLES_KEY } from '../../core/decorators/role.decorator';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { CookieHelper } from '../../utils/cookie.helper';

/**
 * NestAuthAuthGuard
 *
 * Handles authentication and authorization for protected routes.
 * Token refresh is handled by RefreshTokenInterceptor (applied globally).
 *
 * This guard verifies:
 * - JWT tokens (Bearer)
 * - API keys
 * - MFA requirements
 * - Roles and permissions
 *
 * Note: For automatic token refresh, enable RefreshTokenInterceptor globally.
 */
@Injectable()
export class NestAuthAuthGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private jwtService: JwtService,
        private sessionManager: SessionManagerService,
        private accessKeyService: AccessKeyService,
        private authConfigService: AuthConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>() as any;
        const response = context.switchToHttp().getResponse<Response>();

        // Check if authentication is optional
        const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Initialize request properties
        request.user = null;
        request.session = null;
        request.accessKey = null;
        request.authType = null;

        // Get token from header or cookie based on configuration
        const { token, authType } = this.extractToken(request);

        // If no token found
        if (!token) {
            if (isOptional) {
                // Optional auth: allow request to proceed without user data
                return true;
            } else {
                // Required auth: throw error
                throw new UnauthorizedException({
                    message: 'No authentication provided',
                    code: ERROR_CODES.NO_AUTH_PROVIDED
                });
            }
        }

        // Handle authentication
        let isAuthenticated = false;
        try {
            switch (authType) {
                case 'bearer':
                    isAuthenticated = await this.handleJwtAuth(context, request, response, token, isOptional);
                    break;
                case 'apikey':
                    isAuthenticated = await this.handleApiKeyAuth(request, token, isOptional);
                    break;
                default:
                    if (isOptional) {
                        // Invalid auth type, but optional - proceed without user data
                        return true;
                    } else {
                        throw new UnauthorizedException({
                            message: 'Invalid authentication type',
                            code: ERROR_CODES.INVALID_AUTH_TYPE
                        });
                    }
            }
        } catch (error) {
            if (isOptional) {
                // If optional auth fails, silently proceed without user data (e.g. invalid token)
                return true;
            } else {
                // If required auth fails, re-throw the error
                throw error;
            }
        }

        // If authentication failed and it's required, stop here
        if (!isAuthenticated && !isOptional) {
            return false;
        }

        // After successful authentication, check authorization (roles, permissions)
        // Only check authorization if user is authenticated and we have user data
        if (isAuthenticated && request.user) {
            await this.checkAuthorization(context, request);
        }

        return true;
    }

    /**
     * Extract token from request (header or cookie)
     * Priority: Header first, then cookie
     * Respects accessTokenType configuration:
     * - 'header': Only check Authorization header
     * - 'cookie': Only check cookies
     * - null/undefined: Check both (header first)
     */
    private extractToken(request: Request): { token: string | null; authType: 'bearer' | 'apikey' | null } {
        const config = this.authConfigService.getConfig();
        const accessTokenType = config.accessTokenType;

        // Determine which sources to check based on configuration
        const checkHeader = accessTokenType !== 'cookie';
        const checkCookie = accessTokenType !== 'header';

        // Try Authorization header first (if allowed)
        if (checkHeader) {
            const authHeader = request.headers.authorization;
            if (authHeader) {
                const [type, token] = authHeader.split(' ');
                if (type && token) {
                    const authType = type.toLowerCase() as 'bearer' | 'apikey';
                    if (authType === 'bearer' || authType === 'apikey') {
                        return { token, authType };
                    }
                }
            }
        }

        // Try cookies (if allowed)
        if (checkCookie) {
            // Use CookieHelper for robust cookie parsing (works even without cookie-parser middleware)
            const cookieToken = CookieHelper.get(request, 'accessToken');
            if (cookieToken) {
                return { token: cookieToken, authType: 'bearer' };
            }
        }

        return { token: null, authType: null };
    }

    private async handleJwtAuth(context: ExecutionContext, request: any, response: Response, token: string, isOptional: boolean = false): Promise<boolean> {
        try {
            // Verify the JWT token
            const payload = await this.jwtService.verifyToken(token);

            const config = this.authConfigService.getConfig();

            // Apply guards.beforeAuth hook if configured
            if (config.guards?.beforeAuth) {
                const result = await config.guards.beforeAuth(request, payload);
                if (result && result.reject) {
                    throw new UnauthorizedException({
                        message: result.reason || 'Authentication rejected by custom guard',
                        code: ERROR_CODES.ACCESS_DENIED
                    });
                }
            }

            request.user = payload;
            request.authType = 'jwt';

            // Verify session exists
            const session = await this.sessionManager.getSession(payload.sessionId as string);
            if (!session) {
                if (isOptional) {
                    // Session not found but auth is optional - reset user data and continue
                    request.user = null;
                    request.authType = null;
                    return false;
                } else {
                    throw new UnauthorizedException({
                        message: 'Session not found',
                        code: ERROR_CODES.SESSION_NOT_FOUND
                    });
                }
            }

            // Apply jwt.validateToken hook if configured
            if (config.jwt?.validateToken) {
                const isValid = await config.jwt.validateToken(payload, session);
                if (!isValid) {
                    throw new UnauthorizedException({
                        message: 'Token validation failed',
                        code: ERROR_CODES.INVALID_TOKEN
                    });
                }
            }

            request.session = session;

            // Check if user is active
            if (session.user && session.user.isActive === false) {
                if (isOptional) {
                    request.user = null;
                    request.authType = null;
                    return false;
                } else {
                    throw new UnauthorizedException({
                        message: 'User is not active',
                        code: ERROR_CODES.ACCOUNT_INACTIVE
                    });
                }
            }

            // Check MFA requirements
            await this.checkMfa(context, payload, isOptional);

            // Apply guards.afterAuth hook if configured
            if (config.guards?.afterAuth) {
                // We need the full user object for the hook if possible, but the signature asks for NestAuthUser
                // The payload is just the JWT payload. The session has the user data.
                // Let's try to use session.data.user if available, otherwise we might need to fetch it or cast payload
                // The interface says user: NestAuthUser. session.data.user is usually the user object.
                if (session.data?.user) {
                    await config.guards.afterAuth(request, session.data.user, session);
                }
            }

            return true;
        } catch (error) {
            // Token verification failed
            // Note: Token refresh is handled by RefreshTokenInterceptor
            if (isOptional) {
                // Auth is optional - continue without user data
                return true; 
            } else {
                // If it's already an HttpException (like UnauthorizedException from our checks), rethrow it
                if (error instanceof UnauthorizedException || (error as any).status) {
                    throw error;
                }

                throw new UnauthorizedException({
                    message: 'Invalid or expired token',
                    code: ERROR_CODES.INVALID_TOKEN
                });
            }
        }
    }

    private async handleApiKeyAuth(request: any, token: string, isOptional: boolean = false): Promise<boolean> {
        // Split the token into public and private parts
        const [publicKey, privateKey] = token.split('.');
        if (!publicKey || !privateKey) {
            if (isOptional) {
                // Invalid format but auth is optional - continue without user data
                return false;
            } else {
                throw new UnauthorizedException({
                    message: 'Invalid API key format',
                    code: ERROR_CODES.INVALID_API_KEY_FORMAT
                });
            }
        }

        try {
            // Validate API key pair
            const isValid = await this.accessKeyService.validateAccessKey(publicKey, privateKey);
            if (!isValid) {
                if (isOptional) {
                    // Invalid API key but auth is optional - continue without user data
                    return false;
                } else {
                    throw new UnauthorizedException({
                        message: 'Invalid API key',
                        code: ERROR_CODES.INVALID_API_KEY
                    });
                }
            }

            // Get access key details
            const accessKey = await this.accessKeyService.getAccessKey(publicKey);

            // Update last used timestamp
            await this.accessKeyService.updateAccessKeyLastUsed(publicKey);

            // Attach user and access key to request
            request.user = accessKey.user;
            request.accessKey = accessKey;
            request.authType = 'api-key';

            return true;
        } catch (error) {
            if (isOptional) {
                // API key validation failed but auth is optional - continue without user data
                return false;
            } else {
                throw error;
            }
        }
    }


    private async checkMfa(context: ExecutionContext, payload: JWTTokenPayload, isOptional: boolean = false): Promise<void> {
        // Check if MFA should be skipped
        const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Get MFA status from token
        const isMfaEnabled = payload.isMfaEnabled;
        const isMfaVerified = payload.isMfaVerified;

        // If MFA is enabled and not verified, and route is not marked to skip MFA, require MFA verification
        if (isMfaEnabled && !isMfaVerified && !skipMfa) {
            if (isOptional) {
                // MFA required but auth is optional - this creates a conflict
                // In this case, we should not set user data since MFA is not verified
                throw new Error('MFA verification required - cannot proceed with optional auth');
            } else {
                throw new UnauthorizedException({
                    message: 'Multi-factor authentication is required',
                    code: ERROR_CODES.MFA_REQUIRED
                });
            }
        }
    }

    /**
     * Check authorization (roles, permissions) after successful authentication
     */
    private async checkAuthorization(context: ExecutionContext, request: Request): Promise<void> {
        // Get required permissions and roles from decorators
        const requiredPermissions = this.getRequiredPermissions(context);
        const requiredRoles = this.getRequiredRoles(context);

        // If no authorization requirements, allow access
        if (!requiredPermissions.length && !requiredRoles.length) {
            return;
        }

        const user = request.user;

        // Check if user exists
        if (!user) {
            throw new ForbiddenException({
                message: 'Access denied: User not authenticated',
                code: ERROR_CODES.UNAUTHORIZED,
            });
        }

        // If isFetchUser=false, we might not have roles in the user object (which is just payload)
        // Unless roles are in payload.
        // Assuming roles are NOT in payload by default unless configured.
        // If we need roles check but have no roles/data, we must throw or fetch.
        // For now, if defaults are used, user is just payload.

        // Check roles if required
        if (requiredRoles.length > 0) {
            await this.checkRoles(user, requiredRoles);
        }

        // Check permissions if required
        if (requiredPermissions.length > 0) {
            await this.checkPermissions(user, requiredPermissions);
        }
    }

    /**
     * Get required permissions from decorator
     */
    private getRequiredPermissions(context: ExecutionContext): string[] {
        let permissions = this.reflector.getAllAndOverride<string[] | string>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!permissions) {
            return [];
        }

        // Normalize to array
        return typeof permissions === 'string' ? [permissions] : permissions;
    }

    /**
     * Get required roles from decorator
     */
    private getRequiredRoles(context: ExecutionContext): string[] {
        let roles = this.reflector.getAllAndOverride<string[] | string>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!roles) {
            return [];
        }

        // Normalize to array
        return typeof roles === 'string' ? [roles] : roles;
    }

    /**
     * Check if user has required roles
     */
    /**
     * Check if user has required roles
     */
    /**
     * Helper to resolve user roles
     */
    private async resolveUserRoles(user: any): Promise<string[]> {
        const config = this.authConfigService.getConfig();

        // Apply authorization.resolveRoles hook if configured
        if (config.authorization?.resolveRoles) {
            return await config.authorization.resolveRoles(user);
        }

        // Default behavior
        if (!user.roles || !Array.isArray(user.roles)) {
            // Return empty array instead of throwing, let the caller decide
            return [];
        }

        // Get active role names
        return user.roles
            .filter((role: any) => role.isActive)
            .map((role: any) => role.name);
    }

    /**
     * Check if user has required roles
     */
    private async checkRoles(user: any, requiredRoles: string[]): Promise<void> {
        const userRoleNames = await this.resolveUserRoles(user);

        if (userRoleNames.length === 0 && (!user.roles || !Array.isArray(user.roles))) {
            throw new ForbiddenException({
                message: 'Access denied: No roles assigned',
                code: ERROR_CODES.NO_ROLES_ASSIGNED,
            });
        }

        // Check if user has all required roles
        const hasAllRoles = requiredRoles.every(role => userRoleNames.includes(role));

        if (!hasAllRoles) {
            const missingRoles = requiredRoles.filter(role => !userRoleNames.includes(role));
            throw new ForbiddenException({
                message: `Access denied: Missing required roles: ${missingRoles.join(', ')}`,
                code: ERROR_CODES.MISSING_REQUIRED_ROLES,
            });
        }
    }

    /**
     * Check if user has required permissions
     */
    /**
     * Check if user has required permissions
     */
    /**
     * Check if user has required permissions
     */
    private async checkPermissions(user: any, requiredPermissions: string[]): Promise<void> {
        const config = this.authConfigService.getConfig();
        let userPermissions: string[] = [];

        // Apply authorization.resolvePermissions hook if configured
        if (config.authorization?.resolvePermissions) {
            // Resolve roles first as they are needed for the hook
            const roles = await this.resolveUserRoles(user);
            userPermissions = await config.authorization.resolvePermissions(user, roles);
        } else {
            // Default behavior
            if (!user.roles || !Array.isArray(user.roles)) {
                throw new ForbiddenException({
                    message: 'Access denied: No roles assigned for permission check',
                    code: ERROR_CODES.NO_ROLES_ASSIGNED,
                });
            }

            // Get all permissions from user's roles
            userPermissions = this.getUserPermissions(user.roles);
        }

        // Check if user has all required permissions
        const hasAllPermissions = requiredPermissions.every(permission =>
            userPermissions.includes(permission)
        );

        if (!hasAllPermissions) {
            const missingPermissions = requiredPermissions.filter(permission =>
                !userPermissions.includes(permission)
            );

            throw new ForbiddenException({
                message: `Access denied: Missing required permissions: ${missingPermissions.join(', ')}`,
                code: ERROR_CODES.MISSING_REQUIRED_PERMISSIONS,
            });
        }
    }

    /**
     * Extract all permissions from user's roles
     */
    private getUserPermissions(roles: any[]): string[] {
        const permissions = new Set<string>();

        roles.forEach(role => {
            // Skip inactive roles
            if (!role.isActive) {
                return;
            }

            // Add permissions from this role
            if (role.permissions && Array.isArray(role.permissions)) {
                role.permissions.forEach(permission => permissions.add(permission));
            }
        });

        return Array.from(permissions);
    }
}
