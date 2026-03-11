import {
    Injectable, UnauthorizedException, BadRequestException,
    ConflictException,
    ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import {
    EMAIL_AUTH_PROVIDER,
    PHONE_AUTH_PROVIDER,
    ERROR_CODES,
    NestAuthEvents,
    NEST_AUTH_TRUST_DEVICE_KEY,
} from '../../auth.constants';
import { MfaService } from './mfa.service';
import { JwtService } from '../../core/services/jwt.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthSignupRequestDto } from '../dto/requests/signup.request.dto';
import { AuthResponseDto } from '../dto/responses/auth.response.dto';
import { NestAuthLoginRequestDto } from '../dto/requests/login.request.dto';
import { NestAuthVerify2faRequestDto } from '../dto/requests/verify-2fa.request.dto';
import { NestAuthMFAMethodEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { JWTTokenPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { User2faVerifiedEvent } from '../events/user-2fa-verified.event';
import { UserRefreshTokenEvent } from '../events/user-refresh-token.event';
import { LoggedOutEvent } from '../events/logged-out.event';
import { LoggedOutAllEvent } from '../events/logged-out-all.event';
import { AuthProviderUser, BaseAuthProvider } from '../../core/providers/base-auth.provider';
import { AuthProviderRegistryService } from '../../core/services/auth-provider-registry.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { CookieHelper } from '../../utils/cookie.helper';
import { NestAuthSession } from '../../session/entities/session.entity';
import { AuthTokensResponseDto } from '../dto/responses/auth.response.dto';
import { UserService } from '../../user/services/user.service';
import { NEST_AUTH_TENANT_CONTEXT_SERVICE } from '../../auth.constants';
import { ITenantContextService } from '../../tenant/tenant-context/tenant-context.interface';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import { INestAuthUser } from '@ackplus/nest-auth-contracts';




@Injectable()
export class AuthService {

    private readonly authConfig: IAuthModuleOptions;

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        private readonly authProviderRegistry: AuthProviderRegistryService,

        private readonly mfaService: MfaService,

        private readonly sessionManager: SessionManagerService,

        private readonly jwtService: JwtService,

        private readonly eventEmitter: EventEmitter2,

        private readonly tenantService: TenantService,

        private readonly debugLogger: DebugLoggerService,

        private readonly authConfigService: AuthConfigService,

        private readonly userService: UserService,

        @Inject(NEST_AUTH_TENANT_CONTEXT_SERVICE)
        private readonly tenantContext: ITenantContextService,

    ) {

        this.authConfig = this.authConfigService.getConfig();
    }

    getUserWithRolesAndPermissions(userId: string, relations: string[] = []): Promise<NestAuthUser> {
        return this.userRepository.findOne({
            where: { id: userId },
            relations: [
                'roles',
                ...relations
            ],
        });
    }

    async getUser() {
        const user = await RequestContext.currentUser();
        if (!user) {
            return null
        }
        const fullUser = await this.getUserWithRolesAndPermissions(user.id);

        // Apply user.serialize hook if configured
        let serializedUser: any = fullUser;
        if (this.authConfig.user?.serialize) {
            serializedUser = await this.authConfig.user.serialize(fullUser);
        }

        return serializedUser;
    }

    async signup(input: NestAuthSignupRequestDto): Promise<AuthResponseDto> {
        this.debugLogger.logFunctionEntry('signup', 'AuthService', { email: input.email, phone: input.phone, hasPassword: !!input.password });

        try {
            if (this.authConfig.registration?.enabled === false) {
                throw new ForbiddenException({
                    message: 'Registration is disabled',
                    code: ERROR_CODES.REGISTRATION_DISABLED,
                });
            }

            const { email, phone, password , tenantId} = input;

            // Resolve guard from config if available (Server-side enforcement)
            if (this.authConfig.registrationHooks?.beforeSignup) {
                const req = RequestContext.currentRequest();
                input = await this.authConfig.registrationHooks.beforeSignup(input, { request: req });
            }

            // Resolve tenant ID
            await this.tenantService.resolveTenantId(tenantId);

            this.debugLogger.logAuthOperation('signup', 'email|phone', undefined, { email, phone, resolvedTenantId: tenantId });

            if (!email && !phone) {
                this.debugLogger.error('Signup failed: Neither email nor phone provided', 'AuthService');
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            const providersToLink: Array<{ provider: BaseAuthProvider; userId: string; type: string }> = [];

            if (email && this.authConfig.emailAuth?.enabled !== false) {
                const provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
                if (provider) {
                    providersToLink.push({ provider, userId: email, type: 'email' });
                }
            }

            if (phone && this.authConfig.phoneAuth?.enabled === true) {
                const provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
                if (provider) {
                    providersToLink.push({ provider, userId: phone, type: 'phone' });
                }
            }

            if (providersToLink.length === 0) {
                this.debugLogger.error('Provider not found for signup', 'AuthService', { email: !!email, phone: !!phone });
                throw new InternalServerErrorException({
                    message: 'Phone or email authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }

            // Check for existing identities across all providers
            for (const item of providersToLink) {
                this.debugLogger.debug('Checking for existing identity', 'AuthService', { providerUserId: item.userId, type: item.type });
                const identity = await item.provider.findIdentity(item.userId);

                if (identity) {
                    this.debugLogger.warn('Identity already exists', 'AuthService', { email: !!email, phone: !!phone, tenantId });
                    if (item.type === 'email') {
                        throw new BadRequestException({
                            message: 'Email already exists in this tenant',
                            code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
                        });
                    }
                    if (item.type === 'phone') {
                        throw new BadRequestException({
                            message: 'Phone number already exists in this tenant',
                            code: ERROR_CODES.PHONE_ALREADY_EXISTS,
                        });
                    }
                }
            }

            this.debugLogger.debug('Creating new user via UserService', 'AuthService', { email: !!email, phone: !!phone, tenantId });

            // Use UserService to create user, which handles hooks and password hashing
            // We pass the plain password, UserService will hash it if provided
            let user = await this.userService.createUser({
                email,
                phone,
                isVerified: false,
                password
            } as any, tenantId, input);

            this.debugLogger.info('User created successfully', 'AuthService', { userId: user.id, tenantId });

            // Link user to all enabled providers
            for (const item of providersToLink) {
                this.debugLogger.debug('Linking user to provider', 'AuthService', { userId: user.id, providerName: item.provider.providerName });
                // Note: UserService might have already created the identity, but we ensure it's linked here
                await item.provider.linkToUser(user.id, item.userId);
            }

            // Apply onSignup hook if configured - BEFORE session creation
            // This allows role assignment to be reflected in the session
            if (this.authConfig.registrationHooks?.onSignup) {
                this.debugLogger.debug('Applying registrationHooks.onSignup hook', 'AuthService', { userId: user.id });
                const request = RequestContext.currentRequest();
                const modifiedUser = await this.authConfig.registrationHooks.onSignup(user, input, { request });
                if (modifiedUser) {
                    user = modifiedUser;
                }
            }

            user = await this.getUserWithRolesAndPermissions(user.id);

            // Protect against unauthorized signup with guard(potential access violation)
            if (input?.guard && user.roles) {
                const isExistsGuard = user.roles.some(r => r.guard === input.guard);
                if (!isExistsGuard) {
                    await this.userService.deleteUser(user.id);
                    throw new UnauthorizedException({
                        message: 'Not allowed to signup with this guard',
                        code: ERROR_CODES.FORBIDDEN,
                    });
                }
            }

            this.debugLogger.debug('Creating session for new user', 'AuthService', { userId: user.id });
            const session = await this.sessionManager.createSessionFromUser(user, { tenantId });
            const tokens = await this.generateTokensFromSession(session);
            const isRequiresMfa = await this.mfaService.isRequiresMfa(user.id);
            this.debugLogger.debug('Signup tokens generated', 'AuthService', { userId: user.id, isRequiresMfa });

            // Emit registration event
            this.debugLogger.debug('Emitting user registration event', 'AuthService', { userId: user.id });
            const provider = providersToLink[0]?.provider;
            await this.eventEmitter.emitAsync(
                NestAuthEvents.REGISTERED,
                new UserRegisteredEvent({
                    user,
                    tenantId,
                    input,
                    provider,
                    session,
                    tokens,
                    isRequiresMfa
                })
            );

            this.debugLogger.logFunctionExit('signup', 'AuthService', { userId: user.id, isRequiresMfa });

            // Check if auto-login after signup is disabled
            const autoLoginAfterSignup = this.authConfig.registration?.autoLoginAfterSignup !== false; // default: true

            if (!autoLoginAfterSignup) {
                // Return success message without tokens - user must login separately
                return {
                    message: 'Account created successfully. Please login.',
                    accessToken: '',
                    refreshToken: '',
                    isRequiresMfa: false,
                } as any;
            }

            // Build default response with tokens (auto-login enabled)
            return this.generateAuthResponse(user, session, tokens, isRequiresMfa);

        } catch (error) {
            this.debugLogger.logError(error, 'signup', { email: input.email, phone: input.phone });
            this.handleError(error, 'signup');
            throw error;
        }
    }

    async login(input: NestAuthLoginRequestDto): Promise<AuthResponseDto> {
        let { credentials, providerName, createUserIfNotExists = false, guard, tenantId } = input;
       
        this.debugLogger.logFunctionEntry('login', 'AuthService', { providerName, createUserIfNotExists, guard, tenantId });

        try {
            // Resolve tenant ID
            await this.tenantService.resolveTenantId(tenantId);
            
            this.debugLogger.logAuthOperation('login', providerName, undefined, { resolvedTenantId: tenantId, createUserIfNotExists });

            const provider = this.authProviderRegistry.getProvider(providerName);

            if (!provider) {
                throw new UnauthorizedException({
                    message: 'Invalid authentication providerName or provider is not enabled',
                    code: ERROR_CODES.INVALID_PROVIDER,
                });
            }

            const requiredFields = provider.getRequiredFields();

            if (!requiredFields.every(field => credentials[field])) {
                throw new BadRequestException({
                    message: `Missing ${requiredFields.join(', ')} required fields`,
                    code: ERROR_CODES.MISSING_REQUIRED_FIELDS,
                });
            }
            const authProviderUser = await provider.validate(credentials);

            const identity = await provider.findIdentity(authProviderUser.userId);

            let user: NestAuthUser | null = identity?.user || null;

            if (!user) {
                if (!createUserIfNotExists) {
                    throw new UnauthorizedException({
                        message: 'Invalid credentials',
                        code: ERROR_CODES.INVALID_CREDENTIALS,
                    });
                }
                // Create new user if not exists and link to provider
                user = await this.handleSocialLogin(provider, authProviderUser!, tenantId);
            }

            if (user.isActive === false) {
                throw new UnauthorizedException({
                    message: 'Your account is suspended, please contact support',
                    code: ERROR_CODES.ACCOUNT_INACTIVE,
                });
            }

            // Apply onLogin hook if configured - BEFORE session creation
            // This allows role sync to be reflected in the session
            if (this.authConfig.loginHooks?.onLogin) {
                this.debugLogger.debug('Applying loginHooks.onLogin hook', 'AuthService', { userId: user.id });
                const request = RequestContext.currentRequest();
                const modifiedUser = await this.authConfig.loginHooks.onLogin(user, input, { request, provider });
                if (modifiedUser) {
                    user = modifiedUser;
                }
            }

            user = await this.getUserWithRolesAndPermissions(user!.id);

            await this.ensureTenantAccess(user, tenantId, createUserIfNotExists);


            let isRequiresMfa = false;
            let isTrusted = false;

            if (!provider.skipMfa) {
                isRequiresMfa = await this.mfaService.isRequiresMfa(user.id);
            }
            user.isMfaEnabled = isRequiresMfa;

            if (guard && user.roles) {
                const isExistsGuard = user.roles.some(r => r.guard === guard);
                if (!isExistsGuard) {
                    throw new UnauthorizedException({
                        message: 'Invalid credentials',
                        code: ERROR_CODES.INVALID_CREDENTIALS,
                    });
                }
            }

            let session = await this.sessionManager.createSessionFromUser(user, { tenantId });

            if (isRequiresMfa) {
                isTrusted = await this.checkTrustedDevice(user);

                if (isTrusted) {
                    isRequiresMfa = false;
                }

                session = await this.sessionManager.updateSession(session.id, {
                    data: { ...session.data, isMfaEnabled: true, isMfaVerified: isTrusted }
                });
            }

            const tokens = await this.generateTokensFromSession(session);

            // Emit login event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_IN,
                new UserLoggedInEvent({
                    user,
                    tenantId,
                    input,
                    provider,
                    session,
                    tokens,
                    isRequiresMfa
                })
            );

            return this.generateAuthResponse(user, session, tokens, isRequiresMfa);
        } catch (error) {
            this.debugLogger.logError(error, 'login', { providerName, createUserIfNotExists });
            this.handleError(error, 'login');
            throw error;
        }
    }

    async verify2fa(input: NestAuthVerify2faRequestDto) {
        this.debugLogger.logFunctionEntry('verify2fa', 'AuthService', { method: input.method });

        try {
            const session = RequestContext.currentSession();

            if (!session) {
                this.debugLogger.error('Session not found for 2FA verification', 'AuthService');
                throw new UnauthorizedException({
                    message: 'Session not found',
                    code: ERROR_CODES.SESSION_NOT_FOUND,
                });
            }

            this.debugLogger.debug('Verifying MFA code', 'AuthService', { userId: session.userId, method: input.method });
            const isValid = await this.mfaService.verifyMfa(session.userId, input.otp, input.method!);
            if (!isValid) {
                this.debugLogger.warn('Invalid MFA code provided', 'AuthService', { userId: session.userId!, method: input.method });
                throw new UnauthorizedException({
                    message: 'Invalid MFA code',
                    code: ERROR_CODES.MFA_CODE_INVALID,
                });
            }

            this.debugLogger.debug('Updating session with MFA verification', 'AuthService', { sessionId: session.id });
            const payload = await this.sessionManager.updateSession(session.id!, {
                data: {
                    ...session.data!,
                    isMfaVerified: true,
                }
            });
            const tokens = await this.generateTokensFromSession(payload);

            let trustToken: string | undefined;
            if (input.trustDevice) {
                const req = RequestContext.currentRequest();
                if (req) {
                    const userAgent = (req.headers['user-agent'] || '') as string;
                    const ip = (req.ip || req.socket.remoteAddress || '') as string;
                    trustToken = await this.mfaService.createTrustedDevice(session.userId!, userAgent, ip);
                }
            }

            const user = await this.getUser();

            // Emit 2FA verified event
            this.debugLogger.debug('Emitting 2FA verified event', 'AuthService', { userId: user.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_VERIFIED,
                new User2faVerifiedEvent({
                    user: user as NestAuthUser,
                    tenantId: payload.data?.tenantId ?? (user as any)?.tenantId,
                    input,
                    session: payload,
                    tokens
                })
            );

            this.debugLogger.logFunctionExit('verify2fa', 'AuthService', { userId: user.id });

            // Return response with user data (similar to generateAuthResponse)
            return this.generateAuthResponse(user as NestAuthUser, payload, tokens, false, trustToken);

        } catch (error) {
            this.debugLogger.logError(error, 'verify2fa', { method: input.method });
            this.handleError(error, 'mfa');
            throw error;
        }
    }

    async switchTenant(tenantId?: string | null): Promise<AuthResponseDto> {
        const session = RequestContext.currentSession();
        if (!session) {
            throw new UnauthorizedException({
                message: 'Session not found',
                code: ERROR_CODES.SESSION_NOT_FOUND,
            });
        }

        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantId || null);
        const user = await this.userRepository.findOne({ where: { id: session.userId } });
        if (!user) {
            throw new UnauthorizedException({
                message: 'User not found',
                code: ERROR_CODES.USER_NOT_FOUND,
            });
        }

        await this.ensureTenantAccess(user, resolvedTenantId, false);

        const roles = await user.getRoles(resolvedTenantId);
        const permissions = await user.getPermissions(resolvedTenantId);
        const sessionUser = { ...user, tenantId: resolvedTenantId } as NestAuthUser;

        const updatedSession = await this.sessionManager.updateSession(session.id!, {
            data: {
                ...(session.data || {}),
                user: sessionUser,
                roles,
                permissions,
                tenantId: resolvedTenantId || undefined,
            }
        });

        const tokens = await this.generateTokensFromSession(updatedSession);
        return this.generateAuthResponse(user, updatedSession, tokens, false);
    }

    async send2faCode(userId: string, method: NestAuthMFAMethodEnum) {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException({
                message: 'User not found',
                code: ERROR_CODES.USER_NOT_FOUND,
            });
        }

        await this.mfaService.sendMfaCode(user.id, method);

        return true;
    }

    private async handleSocialLogin(
        provider: BaseAuthProvider,
        providerUser: AuthProviderUser,
        tenantId?: string | null,
    ): Promise<NestAuthUser> {

        // Check if identity exists
        let identity = await provider.findIdentity(providerUser.userId);

        if (identity) {
            return identity.user;
        }

        const linkUserWith = provider.linkUserWith();
        const linkUserValue = providerUser?.[linkUserWith] || providerUser.userId;

        let user = await this.userRepository.findOne({ where: { [linkUserWith]: linkUserValue } });

        if (!user) {
            // Create new user via UserService to ensure hooks and events are triggered
            try {
                user = await this.userService.createUser(
                    {
                        [linkUserWith]: linkUserValue,
                        isVerified: true,
                        metadata: providerUser.metadata || {},
                    },
                    tenantId,
                    {
                        [linkUserWith]: linkUserValue,
                        firstName: (providerUser.metadata?.name ?? '').split(' ')[0],
                        lastName: (providerUser.metadata?.name ?? '').split(' ').slice(1).join(' '),
                        ...providerUser,
                        provider: provider.providerName,
                        description: 'Social login auto-creation'
                    }
                );
            } catch (error) {
                // Handle race condition: user might have been created by another process
                if (error instanceof ConflictException || error.status === 409) {
                    user = await this.userRepository.findOne({ where: { [linkUserWith]: linkUserValue } });
                    if (!user) {
                        // If still not found, rethrow
                        throw error;
                    }
                } else {
                    throw error;
                }
            }
        }

        await provider.linkToUser(user.id, providerUser.userId, providerUser.metadata || {});

        return user;
    }

    async refreshToken(refreshToken: string) {
        this.debugLogger.logFunctionEntry('refreshToken', 'AuthService', { hasRefreshToken: !!refreshToken });

        try {
            if (!refreshToken) {
                this.debugLogger.error('No refresh token provided', 'AuthService');
                throw new UnauthorizedException({
                    message: 'No refresh token provided',
                    code: ERROR_CODES.REFRESH_TOKEN_INVALID,
                });
            }

            this.debugLogger.debug('Verifying refresh token', 'AuthService');
            let payload: JWTTokenPayload;
            try {
                payload = await this.jwtService.verifyToken(refreshToken);
            } catch (error) {
                this.debugLogger.warn('Invalid or expired refresh token', 'AuthService');
                throw new UnauthorizedException({
                    message: 'Invalid or expired refresh token',
                    code: ERROR_CODES.REFRESH_TOKEN_EXPIRED,
                });
            }

            if (!payload.sessionId) {
                throw new UnauthorizedException({
                    message: 'Invalid refresh token payload',
                    code: ERROR_CODES.REFRESH_TOKEN_INVALID,
                });
            }

            const session = await this.sessionManager.getSession(payload.sessionId);

            if (!session) {
                throw new UnauthorizedException({
                    message: 'Invalid refresh token',
                    code: ERROR_CODES.REFRESH_TOKEN_INVALID,
                });
            }

            // Refresh existing session
            const newSession = await this.sessionManager.refreshSession(session);

            // Generate new tokens
            this.debugLogger.debug('Generating new tokens from refreshed session', 'AuthService', { sessionId: newSession.id });
            const tokens = await this.generateTokensFromSession(newSession);

            // Emit refresh token event
            this.debugLogger.debug('Emitting refresh token event', 'AuthService', { sessionId: newSession.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.REFRESH_TOKEN,
                new UserRefreshTokenEvent({
                    oldRefreshToken: refreshToken,
                    session: newSession,
                    tokens,
                })
            );

            this.debugLogger.logFunctionExit('refreshToken', 'AuthService', { sessionId: newSession.id });
            return tokens;

        } catch (error) {
            this.debugLogger.logError(error, 'refreshToken', { hasRefreshToken: !!refreshToken });
            this.handleError(error, 'refresh');
            throw error;
        }
    }


    // changePassword moved to PasswordService

    // forgotPassword, verifyForgotPasswordOtp, resetPassword, resetPasswordWithToken moved to PasswordService

    async logout(logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        const session = RequestContext.currentSession();

        const user = await this.getUser();

        if (session) {
            // Emit logout event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_OUT,
                new LoggedOutEvent({
                    user: user as NestAuthUser,
                    tenantId: session?.data?.tenantId ?? (user as any)?.tenantId,
                    session,
                    logoutType,
                    reason,
                })
            );

            await this.sessionManager.revokeSession(session.id);
        }

        return true;
    }

    async logoutAll(userId: string, logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        const sessions = await this.sessionManager.getUserSessions(userId);

        await this.sessionManager.revokeAllUserSessions(userId);

        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (user) {
            // Emit logout event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_OUT_ALL,
                new LoggedOutAllEvent({
                    user,
                    tenantId: user.tenantId,
                    logoutType,
                    reason,
                    sessions,
                })
            );
        }

        return true;
    }

    // sendEmailVerification, verifyEmail moved to VerificationService

    private getTenantMode(): TenantModeEnum {
        const config = this.authConfigService.getConfig();
        const mode = config.tenant?.mode;
        return mode === TenantModeEnum.SHARED ? TenantModeEnum.SHARED : TenantModeEnum.ISOLATED;
    }

    private async ensureTenantAccess(
        user: NestAuthUser,
        tenantId: string | null,
        allowAutoJoin = false
    ): Promise<void> {
        if (!tenantId || !this.tenantContext.isEnabled()) {
            return;
        }

        if (this.getTenantMode() === TenantModeEnum.ISOLATED) {
            if (user.tenantId && user.tenantId !== tenantId) {
                throw new ForbiddenException({
                    message: 'User does not belong to this tenant',
                    code: ERROR_CODES.ACCESS_DENIED,
                });
            }
            return;
        }

        const isMember = await this.userService.isUserInTenant(user.id, tenantId);
        if (!isMember) {
            if (user.tenantId && user.tenantId === tenantId) {
                await this.userService.ensureUserAccess(user.id, tenantId);
                return;
            }
            if (allowAutoJoin) {
                await this.userService.ensureUserAccess(user.id, tenantId);
                return;
            }
            throw new ForbiddenException({
                message: 'User does not belong to this tenant',
                code: ERROR_CODES.ACCESS_DENIED,
            });
        }
    }



    private async generateTokensPayload(session: SessionPayload, otherPayload: Partial<JWTTokenPayload> = {}): Promise<JWTTokenPayload> {

        let payload: JWTTokenPayload = {
            id: session.userId,
            sub: session.userId,
            sessionId: session.id,
            email: session.data?.user?.email,
            phone: session.data?.user?.phone,
            isVerified: session.data?.user?.isVerified,
            roles: session.data?.roles?.map((r) => {
                delete r?.permissions;
                return { ...r }
            }),
            tenantId: session.data?.tenantId ?? session.data?.user?.tenantId,
            isMfaEnabled: session.data?.user?.isMfaEnabled,
            isMfaVerified: session.data?.isMfaVerified,
            ...otherPayload,
        };

        // Apply custom token payload hook if configured
        const config = this.authConfigService.getConfig();
        if (config.session?.customizeTokenPayload) {
            payload = await config.session.customizeTokenPayload(payload, session);
        }

        return payload;
    }

    /**
     * Handle errors using the errorHandler hook if configured
     */
    private handleError(error: Error, context: 'login' | 'signup' | 'refresh' | 'mfa' | 'password_reset' | 'password_change') {
        const config = this.authConfigService.getConfig();
        if (config.errorHandler) {
            // The hook can throw a new error or return a modified one
            // If it returns, we throw that. If it throws, it propagates.
            const result = config.errorHandler(error, context as any);
            if (result) {
                throw result;
            }
        }
    }

    async generateTokensFromSession(session: NestAuthSession): Promise<AuthTokensResponseDto> {
        const payload = await this.generateTokensPayload(session);
        const tokens = await this.jwtService.generateTokens(payload);
        return tokens
    }

    async generateAuthResponse(
        user: NestAuthUser,
        session: any, // NestAuthSession
        tokens: { accessToken: string; refreshToken: string },
        isRequiresMfa: boolean,
        trustToken?: string
    ): Promise<AuthResponseDto> {
        // Serialize user for response
        const config = this.authConfigService.getConfig();
        let serializedUser: Partial<INestAuthUser> = user;
        if (config.user?.serialize) {
            serializedUser = await config.user.serialize(user);
        }

        const activeTenantId = session?.data?.tenantId ?? user.tenantId;
        let tenants = await this.userService.getUserTenants(user.id);
        if (!tenants.length && user.tenantId) {
            const fallbackTenant = await this.tenantService.getTenantById(user.tenantId);
            if (fallbackTenant) {
                tenants = [fallbackTenant];
            }
        }

        const userWithAccesses = await this.getUserWithRolesAndPermissions(user.id, ['userAccesses', 'userAccesses.tenant', 'userAccesses.roles']);

        const userAccesses = userWithAccesses.userAccesses ?? [];

        // Extract role names and permissions
        const rolesForResponse = session?.data?.roles || user.roles || [];
        const roleNames = rolesForResponse?.map(r => r.name) || [];
        const permissions = session?.data?.permissions || this.extractPermissions(user);

        let response: AuthResponseDto = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isRequiresMfa: isRequiresMfa,
            // Include user data in response (not in token) for client-side permission checks
            user: {
                id: serializedUser.id,
                email: serializedUser.email,
                phone: serializedUser.phone,
                isVerified: serializedUser.isVerified,
                isMfaEnabled: serializedUser.isMfaEnabled,
                roles: roleNames,
                permissions,
                metadata: serializedUser.metadata,
                tenantId: activeTenantId,
                tenants,
                userAccesses,
            },
        };

        if (isRequiresMfa) {
            const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
            response.mfaMethods = enabledMethods;
            response.defaultMfaMethod = this.mfaService.mfaConfig?.defaultMethod || enabledMethods[0];
        }

        if (config.auth?.transformResponse) {
            response = await config.auth.transformResponse(response, user, session);
        }

        // Add trustToken if provided (for MFA verification)
        if (trustToken) {
            response.trustToken = trustToken;
        }

        return response;
    }

    /**
     * Extract permission names from user's roles
     */
    private extractPermissions(user: NestAuthUser): string[] {
        const permissions = new Set<string>();
        if (user.roles) {
            for (const role of user.roles) {
                if (role.permissions) {
                    for (const perm of (role?.permissions || [])) {
                        // Permissions are stored as strings in the role entity
                        permissions.add(perm);
                    }
                }
            }
        }
        return Array.from(permissions);
    }

    private async checkTrustedDevice(user: NestAuthUser): Promise<boolean> {
        const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
        const req = RequestContext.currentRequest();

        if (req) {
            let trustToken = CookieHelper.get(req, trustCookieName);
            if (!trustToken) {
                trustToken = req.headers[trustCookieName] as string;
            }

            if (trustToken) {
                return await this.mfaService.validateTrustedDevice(user.id, trustToken);
            }
        }
        return false;
    }
}
