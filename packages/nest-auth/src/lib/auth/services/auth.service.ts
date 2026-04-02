import {
    Injectable, UnauthorizedException, BadRequestException,
    ConflictException,
    ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, IsNull, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { AccessRoleResolver } from '../../role/utils/access-role-resolver.util';
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
import { NestAuthMFAMethodEnum, NestAuthOTPTypeEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { JWTTokenPayload, SessionDataPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
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
import { getRolePermissionNames, mapRoleToSessionSnapshot } from '../../role/utils/role-mapper.util';
import { normalizedEmail, normalizedPhone } from '../../utils';
import { OtpFlowService } from './otp-flow.service';
import { PasswordlessCodeRequestedEvent } from '../events/passwordless-code-requested.event';
import { chain } from 'lodash';
import { NestAuthRole } from '../../role/entities/role.entity';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';


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

        private readonly otpFlow: OtpFlowService,

        @Inject(NEST_AUTH_TENANT_CONTEXT_SERVICE)
        private readonly tenantContext: ITenantContextService,

    ) {

        this.authConfig = this.authConfigService.getConfig();
    }

    getUserWithRoles(userId: string, relations: string[] = []): Promise<NestAuthUser> {
        return this.userRepository.findOne({
            where: { id: userId },
            relations: [
                'userAccesses',
                'userAccesses.roles',
                ...relations
            ],
        });
    }
    async getUserWithAccess(userId: string, tenantId: string, isPlatformAccess = false): Promise<{ user: NestAuthUser, userAccess?: NestAuthUserAccess, platformAccess?: NestAuthPlatformAccess }> {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
                ...(tenantId ? { userAccesses: { tenantId } } : {}),
            }
        });
        if (isPlatformAccess) {
            const platformAccess = await NestAuthPlatformAccess.findOne({
                where: { userId, isActive: true },
                relations: ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
            });
            return { user, platformAccess };
        }
        const userAccess = await NestAuthUserAccess.findOne({
            where: {
                userId,
                isActive: true,
                tenantId: tenantId ? Equal(tenantId) : IsNull(),
            },
            relations: ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
        });

        return { user, userAccess };
    }

    async signup(input: NestAuthSignupRequestDto): Promise<AuthResponseDto> {
        this.debugLogger.logFunctionEntry('signup', 'AuthService', { email: input.email, phone: input.phone, hasPassword: !!input.password });
        const config = this.authConfigService.getConfig();

        const tenantMode = config.tenant?.mode ?? TenantModeEnum.ISOLATED;
        const tenetEnabled = config.tenant?.enabled ?? false;

        try {
            if (this.authConfig.registration?.enabled === false) {
                throw new ForbiddenException({
                    message: 'Registration is disabled',
                    code: ERROR_CODES.REGISTRATION_DISABLED,
                });
            }

            // Resolve guard from config if available (Server-side enforcement)
            if (this.authConfig.registrationHooks?.beforeSignup) {
                const req = RequestContext.currentRequest();
                input = await this.authConfig.registrationHooks.beforeSignup(input, { request: req });
            }

            const { email, phone, password, tenantId } = input;

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

            const providersToLink: Array<{ provider: BaseAuthProvider; providerId: string; type: string }> = [];

            if (email && this.authConfig.emailAuth?.enabled !== false) {
                const provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
                if (provider) {
                    providersToLink.push({ provider, providerId: email, type: 'email' });
                }
            }

            if (phone && this.authConfig.phoneAuth?.enabled === true) {
                const provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
                if (provider) {
                    providersToLink.push({ provider, providerId: phone, type: 'phone' });
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
                const requiredTenantId = this.tenantService.checkRequiredTenant(tenantId);
                const identity = await item.provider.findIdentity(item.providerId, requiredTenantId ? tenantId : undefined);

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
            const user = await this.userService.createUser({
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
                await item.provider.linkToUser(user.id, item.providerId);
            }

            // Apply onSignup hook if configured - BEFORE session creation
            // This allows role assignment to be reflected in the session
            const { user: authUser, userAccess } = await this.getUserWithAccess(user.id, tenantId);

            if (this.authConfig.registrationHooks?.onSignup) {
                this.debugLogger.debug('Applying registrationHooks.onSignup hook', 'AuthService', { userId: user.id });
                const request = RequestContext.currentRequest();
                await this.authConfig.registrationHooks.onSignup(user, input, {userAccess, request });

            }

            // Protect against unauthorized signup with guard(potential access violation)
            if (input?.guard) {
                const isExistsGuard = userAccess?.roles?.some(r => r?.guard === input.guard);
                if (!isExistsGuard) {
                    await this.userService.deleteUser(user.id);
                    throw new UnauthorizedException({
                        message: 'Not allowed to signup with this guard',
                        code: ERROR_CODES.FORBIDDEN,
                    });
                }
            }

            this.debugLogger.debug('Creating session for new user', 'AuthService', { userId: authUser.id });
            const session = await this.sessionManager.createSessionFromUser(authUser, userAccess, { tenantId });
            const tokens = await this.generateTokensFromSession(session);
            const isRequiresMfa = await this.mfaService.isRequiresMfa(authUser.id);
            this.debugLogger.debug('Signup tokens generated', 'AuthService', { userId: authUser.id, isRequiresMfa });

            // Emit registration event
            this.debugLogger.debug('Emitting user registration event', 'AuthService', { userId: authUser.id });
            const provider = providersToLink[0]?.provider;
            await this.eventEmitter.emitAsync(
                NestAuthEvents.REGISTERED,
                new UserRegisteredEvent({
                    user: authUser,
                    userAccess,
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
            return this.generateAuthResponse(authUser, session, tokens, isRequiresMfa, undefined);

        } catch (error) {
            this.debugLogger.logError(error, 'signup', { email: input.email, phone: input.phone });
            this.handleError(error, 'signup');
            throw error;
        }
    }

    async login(input: NestAuthLoginRequestDto): Promise<AuthResponseDto> {
        let { credentials, providerName, createUserIfNotExists = false, guard, tenantId } = input;

        const isPlatformAccess = await AccessRoleResolver.isPlatformAccess();

        this.debugLogger.logFunctionEntry('login', 'AuthService', { providerName, createUserIfNotExists, guard, tenantId });

        try {
            let resolvedTenantId: string | null = null;
            if (isPlatformAccess) {
                resolvedTenantId = null;
            } else {
                await this.tenantService.resolveTenantId(tenantId);
                resolvedTenantId = tenantId;
            }

            this.debugLogger.logAuthOperation('login', providerName, undefined, { tenantId, resolvedTenantId, createUserIfNotExists, isPlatformAccess });

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
            const authProviderUser = await provider.validate(credentials, resolvedTenantId);

            const identity = await provider.findIdentity(authProviderUser.userId, resolvedTenantId);

            let user: NestAuthUser | null = identity?.user || null;

            if (!user) {
                if (!createUserIfNotExists) {
                    throw new UnauthorizedException({
                        message: 'Invalid credentials',
                        code: ERROR_CODES.INVALID_CREDENTIALS,
                    });
                }
                // Create new user if not exists and link to provider
                user = await this.handleSocialLogin(provider, authProviderUser!, resolvedTenantId);
            }

            if (user.isActive === false) {
                throw new UnauthorizedException({
                    message: 'Your account is suspended, please contact support',
                    code: ERROR_CODES.ACCOUNT_INACTIVE,
                });
            }

            const { user: authUser, userAccess, platformAccess } = await this.getUserWithAccess(user.id, resolvedTenantId, isPlatformAccess);
            // Apply onLogin hook if configured - BEFORE session creation
            // This allows role sync to be reflected in the session
            if (this.authConfig.loginHooks?.onLogin) {
                this.debugLogger.debug('Applying loginHooks.onLogin hook', 'AuthService', { userId: authUser.id });
                const request = RequestContext.currentRequest();
                await this.authConfig.loginHooks.onLogin(authUser, input, { userAccess, platformAccess, request, provider });
            }


            if (isPlatformAccess) {
                if (authUser && !platformAccess) {
                    throw new ForbiddenException({
                        message: 'Only platform admins can login',
                        code: ERROR_CODES.ACCESS_DENIED,
                    });
                }
            } else {
                await this.ensureTenantAccess(authUser, resolvedTenantId, createUserIfNotExists);
            }


            let isRequiresMfa = false;
            let isTrusted = false;

            if (!provider.skipMfa) {
                isRequiresMfa = await this.mfaService.isRequiresMfa(authUser.id);
            }
            user.isMfaEnabled = isRequiresMfa;

            if (guard) {
                let guardRoles: NestAuthRole[] = [];
                if (isPlatformAccess) {
                    guardRoles = platformAccess?.roles ?? [];
                } else {
                    guardRoles = userAccess?.roles ?? [];
                }

                const isExistsGuard = guardRoles.some(r => r.guard === guard);
                if (!isExistsGuard) {
                    throw new UnauthorizedException({
                        message: 'Invalid credentials',
                        code: ERROR_CODES.INVALID_CREDENTIALS,
                    });
                }
            }

            let session = await this.sessionManager.createSessionFromUser(authUser, userAccess, {
                tenantId: resolvedTenantId,
                platformAccess: platformAccess,
                isPlatformAccess: isPlatformAccess ?? false
            });

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
                    user: authUser,
                    userAccess,
                    platformAccess,
                    tenantId,
                    input,
                    provider,
                    session,
                    tokens,
                    isRequiresMfa
                })
            );

            return this.generateAuthResponse(authUser, session, tokens, isRequiresMfa);
        } catch (error) {
            this.debugLogger.logError(error, 'login', { providerName, createUserIfNotExists });
            this.handleError(error, 'login');
            throw error;
        }
    }


    private async resolveOrCreateUserForSend(input: {
        channel: 'email' | 'sms';
        identifier: string;
        tenantId?: string;
    }): Promise<NestAuthUser | null> {

        const passwordlessConfig = this.authConfigService.getConfig().passwordless;

        const { channel, tenantId } = input;
        const raw = input.identifier?.trim();
        if (!raw) {
            throw new BadRequestException({
                message: 'Identifier is required',
                code: ERROR_CODES.MISSING_REQUIRED_FIELD,
            });
        }


        if (channel === 'email') {
            const emailNorm = normalizedEmail(raw);
            if (!emailNorm) {
                throw new BadRequestException({
                    message: 'A valid email is required',
                    code: ERROR_CODES.MISSING_REQUIRED_FIELD,
                });
            }
            const provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
            if (!provider) {
                throw new BadRequestException({
                    message: 'Email authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }
            const identity = await provider.findIdentity(emailNorm, tenantId);
            if (identity?.user) {
                return identity.user;
            }
            if (!passwordlessConfig.allowSignUp) {
                return null;
            }
            const reg = this.authConfigService.getConfig().registration;
            if (reg?.enabled === false) {
                throw new ForbiddenException({
                    message: 'Registration is disabled',
                    code: ERROR_CODES.REGISTRATION_DISABLED,
                });
            }
            return this.userService.createUser(
                { email: emailNorm, isVerified: true },
                tenantId ?? undefined,
                { source: 'passwordless', channel: 'email' },
            );
        } else {
            const phoneNorm = normalizedPhone(raw);

            if (!phoneNorm) {
                throw new BadRequestException({
                    message: 'Phone is required',
                    code: ERROR_CODES.MISSING_REQUIRED_FIELD,
                });
            }
            const provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
            if (!provider) {
                throw new BadRequestException({
                    message: 'Phone authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }
            const identity = await provider.findIdentity(phoneNorm, tenantId);
            if (identity?.user) {
                return identity.user;
            }
            if (!passwordlessConfig.allowSignUp) {
                return null;
            }
            const reg = this.authConfigService.getConfig().registration;
            if (reg?.enabled === false) {
                throw new ForbiddenException({
                    message: 'Registration is disabled',
                    code: ERROR_CODES.REGISTRATION_DISABLED,
                });
            }
            return this.userService.createUser(
                { phone: phoneNorm, isVerified: true },
                tenantId ?? undefined,
                { source: 'passwordless', channel: 'sms' },
            );
        }
    }

    async passwordlessSend(input: {
        identifier: string;
        channel: 'email' | 'sms';
        tenantId?: string;
    }): Promise<{ message: string }> {
        const passwordlessConfig = this.authConfigService.getConfig().passwordless;
        if (!passwordlessConfig.enabled) {
            throw new ForbiddenException({
                message: 'Passwordless login is disabled',
                code: ERROR_CODES.PASSWORDLESS_DISABLED,
            });
        }
        this.debugLogger.logFunctionEntry('sendCode', 'AuthService', { channel: input.channel });

        try {
            await this.tenantService.resolveTenantId(input.tenantId);

            const user = await this.resolveOrCreateUserForSend(input);
            if (!user) {
                return { message: 'If an account exists, a login code has been sent' };
            }

            const { entity: otpEntity, plainCode: code } = await this.otpFlow.createOtp({
                userId: user.id,
                type: NestAuthOTPTypeEnum.PASSWORDLESS_LOGIN,
                replaceExisting: true,
            });

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORDLESS_CODE_REQUESTED,
                new PasswordlessCodeRequestedEvent({
                    user,
                    tenantId: input.tenantId,
                    channel: input.channel,
                    otp: otpEntity,
                    code,
                }),
            );

            this.debugLogger.logFunctionExit('sendCode', 'AuthService', { userId: user.id });
            return { message: 'If an account exists, a login code has been sent' };
        } catch (error) {
            this.debugLogger.logError(error, 'sendCode');
            throw error;
        }
    }

    async verify2fa(input: NestAuthVerify2faRequestDto) {
        this.debugLogger.logFunctionEntry('verify2fa', 'AuthService', { method: input.method });
        try {
            let user = await RequestContext.currentUser();
            const session = RequestContext.currentSession();

            if (!session) {
                throw new UnauthorizedException({
                    message: 'Session not found',
                    code: ERROR_CODES.SESSION_NOT_FOUND,
                });
            }

            this.debugLogger.debug('Verifying MFA code', 'AuthService', { userId: session.userId, method: input.method });
            const isValid = await this.mfaService.verifyMfa(session.userId, input.otp, input.method!);
            if (!isValid) {
                throw new UnauthorizedException({
                    message: 'Invalid MFA code',
                    code: ERROR_CODES.MFA_CODE_INVALID,
                });
            }

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

            if (!user) {
                return null
            }

            // Emit 2FA verified event
            this.debugLogger.debug('Emitting 2FA verified event', 'AuthService', { userId: user.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_VERIFIED,
                new User2faVerifiedEvent({
                    user,
                    tenantId: payload.data?.tenantId ?? (user as any)?.tenantId,
                    input,
                    session: payload,
                    tokens
                })
            );

            this.debugLogger.logFunctionExit('verify2fa', 'AuthService', { userId: user.id });

            return this.generateAuthResponse(user, payload, tokens, false, trustToken);

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
        const { user, userAccess } = await this.getUserWithAccess(session.userId!, resolvedTenantId);
        if (!user) {
            throw new UnauthorizedException({
                message: 'User not found',
                code: ERROR_CODES.USER_NOT_FOUND,
            });
        }

        await this.ensureTenantAccess(user, resolvedTenantId, false);

        const rolesWithPermissions = userAccess?.roles ?? [];

        const permissions = chain(rolesWithPermissions)
            .map((role) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();
        const roles = rolesWithPermissions?.map((role) => mapRoleToSessionSnapshot(role));

        const updatedSession = await this.sessionManager.updateSession(session.id!, {
            data: {
                ...(session.data || {}),
                user,
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
        let identity = await provider.findIdentity(providerUser.userId, tenantId);

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

    private async buildSessionDataFromUser(params: {
        user: NestAuthUser;
        tenantId?: string | null;
        isMfaVerified?: boolean;
    }): Promise<SessionDataPayload> {
        const { user, tenantId = null, isMfaVerified = false } = params;
        const { roles, permissions } = await AccessRoleResolver.resolveRolesAndPermissionsForTenantContext({
            userId: user.id,
            tenantId: tenantId ?? null,
        });

        let sessionData: SessionDataPayload = {
            user,
            isMfaVerified,
            roles: roles.map((role) => mapRoleToSessionSnapshot(role)),
            permissions,
            tenantId,
        };

        // Keep behavior aligned with SessionManagerService.createSessionFromUser
        const customize = AuthConfigService.getOptions().session?.customizeSessionData;
        if (customize) {
            sessionData = await customize(sessionData, user);
        }

        return sessionData;
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

            const isPlatformAccess = await AccessRoleResolver.isPlatformAccess();

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

            const { user, userAccess, platformAccess } = await this.getUserWithAccess(session.userId!, session.data?.tenantId ?? null, isPlatformAccess);

            if (!user) {
                await this.sessionManager.revokeSession(session.id);
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            if (user.isActive === false) {
                await this.sessionManager.revokeSession(session.id);
                throw new UnauthorizedException({
                    message: 'Your account is suspended, please contact support',
                    code: ERROR_CODES.ACCOUNT_INACTIVE,
                });
            }

            // Refresh session snapshot (roles/permissions/tenant) before generating new tokens
            const tenantId = session.data?.tenantId ?? null;
            if (!isPlatformAccess && !userAccess) {
                try {
                    await this.ensureTenantAccess(user, tenantId, false);
                } catch (error) {
                    await this.sessionManager.revokeSession(session.id);
                    throw error;
                }
            }
            if (isPlatformAccess && !platformAccess) {
                await this.sessionManager.revokeSession(session.id);
                throw new UnauthorizedException({
                    message: 'You are not authorized to platform access',
                    code: ERROR_CODES.ACCESS_DENIED,
                });
            }


            // Build session data and update 
            const isMfaVerified = !!session.data?.isMfaVerified;
            let roles: NestAuthRole[] = [];
            if (isPlatformAccess) {
                roles = platformAccess?.roles ?? [];
            } else {
                roles = userAccess?.roles ?? [];
            }
            const permissions = chain(roles)
                .map((role: any) => getRolePermissionNames(role))
                .flatten()
                .uniq()
                .value();

            let freshSessionData: SessionDataPayload = {
                user,
                isMfaVerified,
                roles: roles.map((role) => mapRoleToSessionSnapshot(role)),
                permissions,
                tenantId,
                isPlatformAccess: isPlatformAccess ?? false,
            };

            // Keep behavior aligned with SessionManagerService.createSessionFromUser
            const customize = AuthConfigService.getOptions().session?.customizeSessionData;
            if (customize) {
                freshSessionData = await customize(freshSessionData, user);
            }


            // Refresh existing session (expiry/lastActive) and then persist refreshed snapshot
            const refreshedSession = await this.sessionManager.refreshSession(session);
            const updatedSession = await this.sessionManager.updateSession(refreshedSession.id, {
                data: {
                    ...(refreshedSession.data ?? {}),
                    ...freshSessionData,
                },
            });

            // Generate new tokens
            this.debugLogger.debug('Generating new tokens from refreshed session', 'AuthService', { sessionId: updatedSession.id });
            const tokens = await this.generateTokensFromSession(updatedSession);

            // Emit refresh token event
            this.debugLogger.debug('Emitting refresh token event', 'AuthService', { sessionId: updatedSession.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.REFRESH_TOKEN,
                new UserRefreshTokenEvent({
                    oldRefreshToken: refreshToken,
                    session: updatedSession,
                    tokens,
                })
            );

            this.debugLogger.logFunctionExit('refreshToken', 'AuthService', { sessionId: updatedSession.id });

            // Return the same shape as login/signup: tokens + up-to-date user/roles/permissions snapshot
            return this.generateAuthResponse(user, updatedSession, tokens, false);

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

        const user = await RequestContext.currentUser();

        if (session) {
            // Emit logout event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_OUT,
                new LoggedOutEvent({
                    user,
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
                    tenantId: RequestContext.currentTenantId(),
                    logoutType,
                    reason,
                    sessions,
                })
            );
        }

        return true;
    }

    // sendEmailVerification, verifyEmail moved to VerificationServi
    private async ensureTenantAccess(
        user: NestAuthUser,
        tenantId: string | null,
        allowAutoJoin = false
    ): Promise<void> {
        if (!tenantId || !this.tenantContext.isEnabled()) {
            return;
        }
        const isMember = await this.userService.isUserInTenant(user.id, tenantId);
        if (!isMember) {
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
            roles: session.data?.roles || [],
            tenantId: session.data?.tenantId,
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
        trustToken?: string,
    ): Promise<AuthResponseDto> {
        // Serialize user for response
        const config = this.authConfigService.getConfig();

        let serializedUser: Partial<NestAuthUser> = user;
        if (config.user?.serialize) {
            serializedUser = await config.user.serialize(user);
        }

        const activeTenantId = session?.data?.tenantId;
        let tenants = await this.userService.getUserTenants(user.id);
        if (!tenants.length && activeTenantId) {
            const fallbackTenant = await this.tenantService.getTenantById(activeTenantId);
            if (fallbackTenant) {
                tenants = [fallbackTenant];
            }
        }

        // Extract role names and permissions
        const rolesForResponse = session?.data?.roles || [];
        const roleNames = rolesForResponse?.map(r => r.name) || [];
        const permissions = session?.data?.permissions || [];

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
