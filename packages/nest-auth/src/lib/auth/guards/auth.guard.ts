import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ERROR_CODES, OPTIONAL_AUTH_KEY } from '../../auth.constants';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { JwtService } from '../../core/services/jwt.service';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { AccessKeyService } from '../../user/services/access-key.service';
import { JWTTokenPayload } from '../../core/interfaces/token-payload.interface';
import { SKIP_MFA_KEY } from '../../core/decorators/skip-mfa.decorator';
import { PERMISSIONS_KEY, PERMISSIONS_REQUIRE_ALL_KEY } from '../../core/decorators/permissions.decorator';
import { ROLES_KEY, GUARD_KEY } from '../../core/decorators/role.decorator';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { CookieHelper } from '../../utils/cookie.helper';
import { uniq } from 'lodash';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';

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
        private debugLogger: DebugLoggerService,
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
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
                this.debugLogger.warn('Required auth - no token provided', 'AuthGuard');
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
                    this.debugLogger.debug('Handling JWT authentication', 'AuthGuard');
                    isAuthenticated = await this.handleJwtAuth(context, request, response, token, isOptional);
                    break;
                case 'apikey':
                    this.debugLogger.debug('Handling API key authentication', 'AuthGuard');
                    isAuthenticated = await this.handleApiKeyAuth(request, token, isOptional);
                    break;
                default:
                    this.debugLogger.warn(`Invalid auth type: ${authType}`, 'AuthGuard');
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
            this.debugLogger.logError(error as Error, 'AuthGuard', { isOptional, authType });
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
            this.debugLogger.warn('Authentication failed (required)', 'AuthGuard');
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

        this.debugLogger.verbose('No token found in request', 'AuthGuard');
        return { token: null, authType: null };
    }

    private resetAuth(request: any) {
        request.user = null;
        request.session = null;
        request.accessKey = null;
        request.authType = null;
    }

    private async handleJwtAuth(
        context: ExecutionContext,
        request: any,
        response: Response,
        token: string,
        isOptional = false,
    ): Promise<boolean> {
        try {
            const payload = await this.jwtService.verifyToken(token);
            const config = this.authConfigService.getConfig();

            if (config.guards?.beforeAuth) {
                const result = await config.guards.beforeAuth(request, payload);
                if (result && result.reject) {
                    throw new UnauthorizedException({
                        message: result.reason || 'Authentication rejected by custom guard',
                        code: ERROR_CODES.ACCESS_DENIED,
                    });
                }
            }

            request.user = payload;
            request.authType = 'jwt';

            const session = await this.sessionManager.getSession(payload.sessionId as string);
            if (!session) {
                if (isOptional) {
                    this.resetAuth(request);
                    return false;
                }
                throw new UnauthorizedException({
                    message: 'Session not found',
                    code: ERROR_CODES.SESSION_NOT_FOUND,
                });
            }

            if (config.jwt?.validateToken) {
                const isValid = await config.jwt.validateToken(payload, session);
                if (!isValid) {
                    throw new UnauthorizedException({
                        message: 'Token validation failed',
                        code: ERROR_CODES.INVALID_TOKEN,
                    });
                }
            }

            request.session = session;

            const user = await this.userRepository.findOne({
                where: { id: session.userId },
                select: ['id', 'isActive', 'isVerified'],
            });

            if (!user || user.isActive === false) {
                if (isOptional) {
                    this.resetAuth(request);
                    return false;
                }
                throw new UnauthorizedException({
                    message: !user ? 'User not found' : 'User is not active',
                    code: ERROR_CODES.ACCOUNT_INACTIVE,
                });
            }

            await this.checkMfa(context, payload, isOptional);

            if (config.guards?.afterAuth && session.data?.user) {
                await config.guards.afterAuth(request, session.data.user, session);
            }

            return true;
        } catch (error) {
            if (isOptional) {
                this.resetAuth(request);
                return false; // <-- key change
            }

            if (error instanceof UnauthorizedException || (error as any).status) throw error;

            throw new UnauthorizedException({
                message: 'Invalid or expired token',
                code: ERROR_CODES.INVALID_TOKEN,
            });
        }
    }

    private async handleApiKeyAuth(request: any, token: string, isOptional: boolean = false): Promise<boolean> {
        // Split the token into public and private parts
        const [publicKey, privateKey] = token.split('.');
        if (!publicKey || !privateKey) {
            this.debugLogger.warn('Invalid API key format', 'AuthGuard');
            if (isOptional) {
                // Invalid format but auth is optional - continue without user data
                return true;
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
                this.debugLogger.warn('Invalid API key', 'AuthGuard');
                if (isOptional) {
                    // Invalid API key but auth is optional - continue without user data
                    return true;
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
            this.debugLogger.logError(error as Error, 'AuthGuard.handleApiKeyAuth');
            if (isOptional) {
                return true;
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
            this.debugLogger.warn('MFA verification required but not verified', 'AuthGuard');
            if (isOptional) {
                return;
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
        const requiredGuard = this.getRequiredGuard(context);

        // If no authorization requirements, allow access
        if (!requiredPermissions.length && !requiredRoles.length) {
            this.debugLogger.debug('No authorization requirements - allowing access', 'AuthGuard');
            return;
        }

        const user = request.user;
        const session = request.session;

        // Check if user exists
        if (!user) {
            this.debugLogger.warn('Authorization check failed - no user', 'AuthGuard');
            throw new ForbiddenException({
                message: 'Access denied: User not authenticated',
                code: ERROR_CODES.UNAUTHORIZED,
            });
        }

        // Prefer session data for authorization checks as it has complete role/permission information
        // Token payload may have partial role data (permissions are removed for security)
        const rolesForAuth = session?.data?.roles || user.roles || [];
        const permissionsForAuth = session?.data?.permissions;

        // Check roles if required (also checks guard if specified)
        if (requiredRoles.length > 0) {
            await this.checkRoles(user, rolesForAuth, requiredRoles, requiredGuard);
        }

        // Check permissions if required
        if (requiredPermissions.length > 0) {
            const requireAll = this.getPermissionsRequireAll(context);
            await this.checkPermissions(user, rolesForAuth, permissionsForAuth, requiredPermissions, requireAll);
        }
    }

    /**
     * Get required permissions from decorator
     */
    private getRequiredPermissions(context: ExecutionContext): string[] {
        const permissions = this.reflector.getAllAndOverride<string[] | string>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no decorator is set, return empty array (no authorization required)
        if (!permissions || permissions === undefined || permissions === null) {
            return [];
        }

        // Normalize to array
        if (typeof permissions === 'string') {
            return permissions.trim() ? [permissions] : [];
        }

        // Filter out empty strings and ensure it's an array
        if (Array.isArray(permissions)) {
            return permissions.filter(p => p && typeof p === 'string' && p.trim().length > 0);
        }

        return [];
    }

    /**
     * Get whether all permissions are required (true) or any one (false) from decorator.
     * Defaults to false for backward compatibility.
     */
    private getPermissionsRequireAll(context: ExecutionContext): boolean {
        const requireAll = this.reflector.getAllAndOverride<boolean>(
            PERMISSIONS_REQUIRE_ALL_KEY,
            [context.getHandler(), context.getClass()],
        );
        return requireAll !== false;
    }

    /**
     * Get required roles from decorator
     */
    private getRequiredRoles(context: ExecutionContext): string[] {
        const roles = this.reflector.getAllAndOverride<string[] | string>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no decorator is set, return empty array (no authorization required)
        if (!roles || roles === undefined || roles === null) {
            return [];
        }

        // Normalize to array
        if (typeof roles === 'string') {
            return roles.trim() ? [roles] : [];
        }

        // Filter out empty strings and ensure it's an array
        if (Array.isArray(roles)) {
            return roles.filter(r => r && typeof r === 'string' && r.trim().length > 0);
        }

        return [];
    }

    /**
     * Get required guard from decorator
     */
    private getRequiredGuard(context: ExecutionContext): string | undefined {
        return this.reflector.getAllAndOverride<string>(
            GUARD_KEY,
            [context.getHandler(), context.getClass()],
        );
    }

    /**
     * Helper to resolve user roles from roles array
     */
    private async resolveUserRoles(user: any, roles: any[]): Promise<string[]> {
        const config = this.authConfigService.getConfig();

        // Apply authorization.resolveRoles hook if configured
        if (config.authorization?.resolveRoles) {
            return await config.authorization.resolveRoles(user);
        }

        // Default behavior
        if (!roles || !Array.isArray(roles)) {
            // Return empty array instead of throwing, let the caller decide
            return [];
        }

        // Get active role names
        return roles
            .filter((role: any) => role?.isActive !== false) // Handle undefined/null as active
            .map((role: any) => role?.name)
            .filter((name: any) => name); // Remove undefined/null names
    }

    /**
     * Check if user has required roles
     * If a guard is specified, first verify the user's guard matches before checking roles
     */
    private async checkRoles(user: JWTTokenPayload, rolesForAuth: any[], requiredRoles: string[], requiredGuard?: string): Promise<void> {
        // If a guard is specified, check if user's guard matches first
        if (requiredGuard) {
            const userGuards = uniq(
                rolesForAuth
                    .map((role: any) => role?.guard)
                    .filter((guard: any) => guard) // Remove undefined/null guards
            );
            if (userGuards.length === 0 || !userGuards.includes(requiredGuard)) {
                throw new ForbiddenException({
                    message: `Access denied: Guard mismatch. Required: ${requiredGuard}, Found: ${userGuards.length > 0 ? userGuards.join(', ') : 'none'}`,
                    code: ERROR_CODES.GUARD_MISMATCH,
                });
            }
        }

        const userRoleNames = await this.resolveUserRoles(user, rolesForAuth);

        if (userRoleNames.length === 0) {
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
     * Check if user has required permissions.
     * @param requireAll - If true, user must have ALL permissions; if false, user must have ANY ONE.
     */
    private async checkPermissions(
        user: any,
        rolesForAuth: any[],
        permissionsForAuth: string[] | undefined,
        requiredPermissions: string[],
        requireAll: boolean = true,
    ): Promise<void> {
        const config = this.authConfigService.getConfig();
        let userPermissions: string[] = [];

        // Apply authorization.resolvePermissions hook if configured
        if (config.authorization?.resolvePermissions) {
            // Resolve roles first as they are needed for the hook
            const roles = await this.resolveUserRoles(user, rolesForAuth);
            userPermissions = await config.authorization.resolvePermissions(user, roles);
        } else {
            // Prefer permissions from session data if available (more reliable)
            if (permissionsForAuth && Array.isArray(permissionsForAuth)) {
                userPermissions = permissionsForAuth;
            } else {
                // Fallback to extracting permissions from roles
                if (!rolesForAuth || !Array.isArray(rolesForAuth) || rolesForAuth.length === 0) {
                    throw new ForbiddenException({
                        message: 'Access denied: No roles assigned for permission check',
                        code: ERROR_CODES.NO_ROLES_ASSIGNED,
                    });
                }

                // Get all permissions from user's roles
                userPermissions = this.getUserPermissions(rolesForAuth);
            }
        }

        const hasRequired = requireAll
            ? requiredPermissions.every((p) => userPermissions.includes(p))
            : requiredPermissions.some((p) => userPermissions.includes(p));

        if (!hasRequired) {
            const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));
            const message = requireAll
                ? `Access denied: Missing required permissions: ${missing.join(', ')}`
                : `Access denied: Requires at least one of: ${requiredPermissions.join(', ')}`;
            throw new ForbiddenException({
                message,
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
            if (role?.isActive === false) return;

            // Add permissions from this role
            if (role.permissions && Array.isArray(role.permissions)) {
                role.permissions.forEach(permission => permissions.add(permission));
            }
        });

        return Array.from(permissions);
    }
}
