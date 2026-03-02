import {
    Injectable, UnauthorizedException, BadRequestException,
    ConflictException,
    ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
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
import {
    IIdentifierLoginMethod,
    IIdentifierLookupRequest,
    IIdentifierLookupResponse,
    IIdentifierLookupTenant,
    IIdentifierMagicLinkLoginChallengeRequest,
    IIdentifierMagicLinkLoginVerifyRequest,
    IIdentifierOtpLoginChallengeRequest,
    IIdentifierOtpLoginVerifyRequest,
    IIdentifierPasswordLoginRequest,
    IIdentifierSocialLoginRequest,
    IIdentifierType,
    NestAuthMFAMethodEnum,
    NestAuthOTPTypeEnum
} from '@ackplus/nest-auth-contracts';
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
import { NestAuthOTP } from '../entities/otp.entity';
import {
    IIdentifierFirstAuthOptions,
    ILoginOptions,
    IPasswordlessLoginOptions,
} from '../../core/interfaces/auth-module-options.interface';
import { generateOtp } from '../../utils/otp';
import ms from 'ms';
import { MagicLinkChallengeResponseDto } from '../dto/responses/magic-link-challenge.response.dto';

interface IdentifierLookupTokenPayload {
    identifier: string;
    identifierType: IIdentifierType;
    tenantId?: string | null;
    tenantIds?: string[];
    guard?: string;
    type?: string;
}

interface IdentifierResolutionContext {
    identifier: string;
    identifierType: IIdentifierType;
    tenantId?: string | null;
    tenantIds: string[];
    guard?: string;
}




@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthOTP)
        private readonly otpRepository: Repository<NestAuthOTP>,

        private readonly authProviderRegistry: AuthProviderRegistryService,

        private readonly mfaService: MfaService,

        private readonly sessionManager: SessionManagerService,

        private readonly jwtService: JwtService,

        private readonly eventEmitter: EventEmitter2,

        private readonly tenantService: TenantService,

        private readonly debugLogger: DebugLoggerService,

        private readonly authConfigService: AuthConfigService,

        private readonly userService: UserService,
    ) {

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
        const user = RequestContext.currentUser();
        if (!user) {
            return null
        }
        const fullUser = await this.getUserWithRolesAndPermissions(user.id);

        // Apply user.serialize hook if configured
        const config = this.authConfigService.getConfig();
        if (config.user?.serialize) {
            return await config.user.serialize(fullUser);
        }

        return fullUser;
    }

    async identifierLookup(input: IIdentifierLookupRequest): Promise<IIdentifierLookupResponse> {
        this.assertIdentifierFirstEnabled();

        const options = this.getIdentifierFirstOptions();
        const { identifier, identifierType } = this.normalizeIdentifier(input.identifier);
        let resolvedTenantId = await this.resolveTenantIdFromInput(input.tenantId, input.tenantSlug);

        if (resolvedTenantId === undefined && options.loginMode === 'tenant-specific') {
            const defaultTenantId = await this.tenantService.resolveTenantId(null);
            if (defaultTenantId) {
                resolvedTenantId = defaultTenantId;
            }
        }

        const users = await this.findUsersByIdentifier(identifier, identifierType, resolvedTenantId);
        const tenants = this.mapLookupTenants(users);

        let requiresTenantSelection = false;
        if (resolvedTenantId === undefined) {
            const uniqueTenantKeys = Array.from(new Set(users.map(user => user.tenantId || '__global__')));
            if (uniqueTenantKeys.length > 1) {
                requiresTenantSelection = true;
                resolvedTenantId = null;
            } else if (uniqueTenantKeys.length === 1) {
                resolvedTenantId = uniqueTenantKeys[0] === '__global__' ? null : uniqueTenantKeys[0];
            } else {
                resolvedTenantId = null;
            }
        }

        const tenantIds = Array.from(new Set(users.map(user => user.tenantId).filter(Boolean))) as string[];
        const lookupToken = await this.jwtService.generateIdentifierLookupToken({
            identifier,
            identifierType,
            tenantId: resolvedTenantId ?? null,
            tenantIds,
            guard: input.guard,
        });

        const fallbackMethods = this.getEnabledIdentifierMethods();
        const availableMethods = users.length > 0 ? this.getEnabledIdentifierMethods(users) : fallbackMethods;

        if (!options.allowIdentifierEnumeration && users.length === 0) {
            return {
                message: 'Lookup successful',
                identifier,
                identifierType,
                lookupToken,
                resolvedTenantId: resolvedTenantId ?? null,
                requiresTenantSelection: false,
                tenants: [],
                availableMethods: fallbackMethods,
            };
        }

        return {
            message: 'Lookup successful',
            identifier,
            identifierType,
            lookupToken,
            resolvedTenantId: resolvedTenantId ?? null,
            requiresTenantSelection,
            tenants,
            availableMethods,
        };
    }

    async identifierPasswordLogin(input: IIdentifierPasswordLoginRequest): Promise<AuthResponseDto> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('password');

        const context = await this.resolveIdentifierContext({
            lookupToken: input.lookupToken,
            identifier: input.identifier,
            tenantId: input.tenantId,
            tenantSlug: input.tenantSlug,
            guard: input.guard,
        });

        const user = await this.resolveUserFromIdentifierContext(context);

        if (!user || !(await user.validatePassword(input.password))) {
            throw new UnauthorizedException({
                message: 'Invalid credentials',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        const provider = this.authProviderRegistry.getProvider(
            context.identifierType === 'email' ? EMAIL_AUTH_PROVIDER : PHONE_AUTH_PROVIDER,
        );

        return this.completeUserLogin(
            user,
            {
                method: 'identifier_password',
                identifier: context.identifier,
                identifierType: context.identifierType,
                tenantId: context.tenantId,
            },
            provider,
            input.guard || context.guard,
            false,
        );
    }

    async identifierOtpChallenge(input: IIdentifierOtpLoginChallengeRequest): Promise<{ message: string }> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('otp');

        const context = await this.resolveIdentifierContext({
            lookupToken: input.lookupToken,
            identifier: input.identifier,
            tenantId: input.tenantId,
            tenantSlug: input.tenantSlug,
        });

        const user = await this.resolveUserFromIdentifierContext(context);
        if (!user) {
            return { message: 'If the account exists, an OTP has been sent' };
        }

        const options = AuthConfigService.getOptions();
        const otpConfig = this.getIdentifierFirstOptions();
        const code = options.otp?.generate
            ? await options.otp.generate(otpConfig.otpLength)
            : generateOtp(otpConfig.otpLength);

        let expiresAtMs: number;
        if (typeof otpConfig.otpExpiresIn === 'string') {
            expiresAtMs = ms(otpConfig.otpExpiresIn);
        } else {
            expiresAtMs = otpConfig.otpExpiresIn;
        }
        if (!expiresAtMs || Number.isNaN(expiresAtMs) || expiresAtMs <= 0) {
            expiresAtMs = 10 * 60 * 1000;
        }

        await this.otpRepository.delete({
            userId: user.id,
            type: NestAuthOTPTypeEnum.LOGIN,
        });

        const otp = this.otpRepository.create({
            userId: user.id,
            type: NestAuthOTPTypeEnum.LOGIN,
            code,
            expiresAt: new Date(Date.now() + expiresAtMs),
        });
        await this.otpRepository.save(otp);

        await this.eventEmitter.emitAsync(
            NestAuthEvents.IDENTIFIER_LOGIN_OTP_SENT,
            {
                user,
                tenantId: user.tenantId,
                otp,
                identifier: context.identifier,
                identifierType: context.identifierType,
            }
        );

        return { message: 'If the account exists, an OTP has been sent' };
    }

    async identifierOtpVerify(input: IIdentifierOtpLoginVerifyRequest): Promise<AuthResponseDto> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('otp');

        const context = await this.resolveIdentifierContext({
            lookupToken: input.lookupToken,
            identifier: input.identifier,
            tenantId: input.tenantId,
            tenantSlug: input.tenantSlug,
            guard: input.guard,
        });

        const user = await this.resolveUserFromIdentifierContext(context);
        if (!user) {
            throw new UnauthorizedException({
                message: 'Invalid credentials',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        const otp = await this.otpRepository.findOne({
            where: {
                userId: user.id,
                type: NestAuthOTPTypeEnum.LOGIN,
                code: input.otp,
                used: false,
            },
        });

        if (!otp) {
            throw new UnauthorizedException({
                message: 'Invalid OTP code',
                code: ERROR_CODES.OTP_INVALID,
            });
        }

        if (otp.expiresAt && otp.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException({
                message: 'OTP has expired',
                code: ERROR_CODES.OTP_EXPIRED,
            });
        }

        otp.used = true;
        await this.otpRepository.save(otp);

        return this.completeUserLogin(
            user,
            {
                method: 'identifier_otp',
                identifier: context.identifier,
                identifierType: context.identifierType,
                tenantId: context.tenantId,
            },
            undefined,
            input.guard || context.guard,
            true,
        );
    }

    async identifierMagicLinkChallenge(
        input: IIdentifierMagicLinkLoginChallengeRequest
    ): Promise<MagicLinkChallengeResponseDto> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('magic_link');

        const context = await this.resolveIdentifierContext({
            lookupToken: input.lookupToken,
            identifier: input.identifier,
            tenantId: input.tenantId,
            tenantSlug: input.tenantSlug,
        });

        const user = await this.resolveUserFromIdentifierContext(context);
        if (!user) {
            return { message: 'If the account exists, a magic link has been sent' };
        }

        const token = await this.jwtService.generateMagicLinkLoginToken({
            userId: user.id,
            tenantId: user.tenantId || null,
            identifier: context.identifier,
            identifierType: context.identifierType,
        });

        await this.eventEmitter.emitAsync(
            NestAuthEvents.IDENTIFIER_MAGIC_LINK_SENT,
            {
                user,
                tenantId: user.tenantId,
                token,
                redirectUri: input.redirectUri,
                identifier: context.identifier,
                identifierType: context.identifierType,
            }
        );

        const response: MagicLinkChallengeResponseDto = {
            message: 'If the account exists, a magic link has been sent',
        };

        if (this.authConfigService.getConfig().debug?.enabled) {
            response.token = token;
        }

        return response;
    }

    async identifierMagicLinkVerify(input: IIdentifierMagicLinkLoginVerifyRequest): Promise<AuthResponseDto> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('magic_link');

        let payload: any;
        try {
            payload = await this.jwtService.verifyMagicLinkLoginToken(input.token);
        } catch (error) {
            if ((error as any)?.name === 'TokenExpiredError') {
                throw new UnauthorizedException({
                    message: 'Magic link has expired',
                    code: ERROR_CODES.LOOKUP_TOKEN_EXPIRED,
                });
            }
            throw new UnauthorizedException({
                message: 'Invalid magic link token',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        if (!payload?.userId || payload?.type !== 'magic_link_login') {
            throw new UnauthorizedException({
                message: 'Invalid magic link token',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        const user = await this.getUserWithRolesAndPermissions(payload.userId);
        if (!user) {
            throw new UnauthorizedException({
                message: 'Invalid credentials',
                code: ERROR_CODES.INVALID_CREDENTIALS,
            });
        }

        if (Object.prototype.hasOwnProperty.call(payload, 'tenantId') && payload.tenantId !== user.tenantId) {
            throw new UnauthorizedException({
                message: 'Invalid magic link token',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        return this.completeUserLogin(
            user,
            {
                method: 'identifier_magic_link',
                identifier: payload.identifier,
                identifierType: payload.identifierType,
                tenantId: payload.tenantId,
            },
            undefined,
            input.guard,
            true,
        );
    }

    async identifierSocialLogin(input: IIdentifierSocialLoginRequest): Promise<AuthResponseDto> {
        this.assertIdentifierFirstEnabled();
        this.ensureIdentifierMethodEnabled('social');

        if (input.providerName === EMAIL_AUTH_PROVIDER || input.providerName === PHONE_AUTH_PROVIDER) {
            throw new BadRequestException({
                message: 'Email and phone providers are not supported in social login endpoint',
                code: ERROR_CODES.INVALID_PROVIDER,
            });
        }

        let lookupPayload: IdentifierLookupTokenPayload | null = null;
        const identifierOptions = this.getIdentifierFirstOptions();

        if (input.lookupToken) {
            lookupPayload = await this.verifyLookupToken(input.lookupToken);
        } else if (identifierOptions.requireLookupToken) {
            throw new UnauthorizedException({
                message: 'Lookup token is required',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        const tenantIdFromInput = await this.resolveTenantIdFromInput(input.tenantId, input.tenantSlug);
        if (
            tenantIdFromInput !== undefined &&
            lookupPayload?.tenantIds?.length &&
            tenantIdFromInput &&
            !lookupPayload.tenantIds.includes(tenantIdFromInput)
        ) {
            throw new UnauthorizedException({
                message: 'Lookup token does not allow this tenant',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        let tenantId = tenantIdFromInput !== undefined ? tenantIdFromInput : lookupPayload?.tenantId;
        if (
            tenantIdFromInput === undefined &&
            lookupPayload?.tenantIds?.length > 1 &&
            (lookupPayload.tenantId === null || lookupPayload.tenantId === undefined)
        ) {
            throw new BadRequestException({
                message: 'Tenant selection is required',
                code: ERROR_CODES.TENANT_SELECTION_REQUIRED,
            });
        }

        if (tenantId === undefined && identifierOptions.loginMode === 'tenant-specific') {
            const defaultTenantId = await this.tenantService.resolveTenantId(null);
            if (defaultTenantId) {
                tenantId = defaultTenantId;
            }
        }

        return this.login({
            providerName: input.providerName,
            credentials: input.credentials as any,
            createUserIfNotExists: input.createUserIfNotExists,
            tenantId: tenantId as any,
            guard: input.guard || lookupPayload?.guard,
        });
    }

    async signup(input: NestAuthSignupRequestDto): Promise<AuthResponseDto> {
        this.debugLogger.logFunctionEntry('signup', 'AuthService', { email: input.email, phone: input.phone, hasPassword: !!input.password });

        try {
            const config = this.authConfigService.getConfig();
            if (config.registration?.enabled === false) {
                throw new ForbiddenException({
                    message: 'Registration is disabled',
                    code: ERROR_CODES.REGISTRATION_DISABLED,
                });
            }

            const { email, phone, password } = input;
            let { tenantId = null } = input;

            // Resolve guard from config if available (Server-side enforcement)
            if (config.registrationHooks?.beforeSignup) {
                const req = RequestContext.currentRequest();
                await config.registrationHooks.beforeSignup(input, { request: req });
            }

            // Resolve tenant ID - use provided or default
            tenantId = await this.tenantService.resolveTenantId(tenantId);
            this.debugLogger.logAuthOperation('signup', 'email|phone', undefined, { email, phone, resolvedTenantId: tenantId });

            if (!email && !phone) {
                this.debugLogger.error('Signup failed: Neither email nor phone provided', 'AuthService');
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            const providersToLink: Array<{ provider: BaseAuthProvider; userId: string; type: string }> = [];

            if (email && config.emailAuth?.enabled !== false) {
                const provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
                if (provider) {
                    providersToLink.push({ provider, userId: email, type: 'email' });
                }
            }

            if (phone && config.phoneAuth?.enabled === true) {
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
                tenantId,
                isVerified: false,
                password
            } as any, input);

            this.debugLogger.info('User created successfully', 'AuthService', { userId: user.id, tenantId });

            // Link user to all enabled providers
            for (const item of providersToLink) {
                this.debugLogger.debug('Linking user to provider', 'AuthService', { userId: user.id, providerName: item.provider.providerName });
                // Note: UserService might have already created the identity, but we ensure it's linked here
                await item.provider.linkToUser(user.id, item.userId);
            }

            // Apply onSignup hook if configured - BEFORE session creation
            // This allows role assignment to be reflected in the session
            if (config.registrationHooks?.onSignup) {
                this.debugLogger.debug('Applying registrationHooks.onSignup hook', 'AuthService', { userId: user.id });
                const request = RequestContext.currentRequest();
                const modifiedUser = await config.registrationHooks.onSignup(user, input, { request });
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
            const session = await this.sessionManager.createSessionFromUser(user);
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
                    tenantId: user.tenantId,
                    input,
                    provider,
                    session,
                    tokens,
                    isRequiresMfa
                })
            );

            this.debugLogger.logFunctionExit('signup', 'AuthService', { userId: user.id, isRequiresMfa });

            // Check if auto-login after signup is disabled
            const autoLoginAfterSignup = config.registration?.autoLoginAfterSignup !== false; // default: true

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
        let { credentials, providerName, createUserIfNotExists = false, guard } = input;
        this.debugLogger.logFunctionEntry('login', 'AuthService', { providerName, createUserIfNotExists, guard });
        let { tenantId = null } = input;

        try {
            // Resolve tenant ID - use provided or default
            tenantId = await this.tenantService.resolveTenantId(tenantId);
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

            return this.completeUserLogin(
                user,
                input,
                provider,
                guard,
                provider.skipMfa,
            );
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
                    tenantId: user?.tenantId!,
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

        let user = await this.userRepository.findOne({
            where: {
                [linkUserWith]: linkUserValue,
                ...(tenantId !== undefined ? { tenantId: tenantId ?? null } : {}),
            }
        });

        if (!user) {
            // Create new user via UserService to ensure hooks and events are triggered
            try {
                user = await this.userService.createUser({
                    [linkUserWith]: linkUserValue,
                    isVerified: true,
                    metadata: providerUser.metadata || {},
                    tenantId: tenantId,
                }, {
                    [linkUserWith]: linkUserValue,
                    ...providerUser,
                    firstName: providerUser.metadata?.name?.split(' ')[0],
                    lastName: providerUser.metadata?.name?.split(' ').slice(1).join(' '),
                    provider: provider.providerName,
                    description: 'Social login auto-creation'
                });
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
                    tenantId: user?.tenantId,
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



    private getIdentifierFirstOptions() {
        const config = this.authConfigService.getConfig();
        const loginOptions = (config.login || {}) as ILoginOptions;
        const legacyOptions = (config.identifierFirstAuth || {}) as IIdentifierFirstAuthOptions;
        const legacyMethods = legacyOptions.methods || {};

        const passwordless = loginOptions.passwordless;
        const passwordlessOptions: IPasswordlessLoginOptions =
            typeof passwordless === 'object' && passwordless !== null ? passwordless : {};
        const passwordlessEnabled = typeof passwordless === 'boolean' ? passwordless : undefined;
        const deprecatedPasswordlessSocial = passwordlessOptions.social;

        const mode = (loginOptions as any).loginMode || loginOptions.mode || legacyOptions.loginMode || 'tenant-specific';
        const passwordEnabled = loginOptions.password !== undefined
            ? loginOptions.password !== false
            : legacyMethods.password !== false;
        const otpEnabled = passwordlessEnabled !== undefined
            ? passwordlessEnabled
            : passwordlessOptions.otp !== undefined
                ? passwordlessOptions.otp !== false
                : legacyMethods.otp !== false;
        const magicLinkEnabled = passwordlessEnabled !== undefined
            ? passwordlessEnabled
            : passwordlessOptions.magicLink !== undefined
                ? passwordlessOptions.magicLink !== false
                : legacyMethods.magicLink !== false;
        const socialEnabled = loginOptions.social !== undefined
            ? loginOptions.social !== false
            : deprecatedPasswordlessSocial !== undefined
                ? deprecatedPasswordlessSocial !== false
                : legacyMethods.social !== false;

        return {
            enabled: loginOptions.enabled !== undefined
                ? loginOptions.enabled === true
                : legacyOptions.enabled === true,
            loginMode: mode,
            lookupTokenExpiresIn: loginOptions.lookupTokenExpiresIn || legacyOptions.lookupTokenExpiresIn || '10m',
            otpExpiresIn: loginOptions.otpExpiresIn || legacyOptions.otpExpiresIn || '10m',
            otpLength: loginOptions.otpLength || legacyOptions.otpLength || 6,
            magicLinkExpiresIn: loginOptions.magicLinkExpiresIn || legacyOptions.magicLinkExpiresIn || '15m',
            requireLookupToken: loginOptions.requireLookupToken !== undefined
                ? loginOptions.requireLookupToken === true
                : legacyOptions.requireLookupToken === true,
            allowIdentifierEnumeration: loginOptions.allowIdentifierEnumeration !== undefined
                ? loginOptions.allowIdentifierEnumeration === true
                : legacyOptions.allowIdentifierEnumeration === true,
            methods: {
                password: passwordEnabled,
                otp: otpEnabled,
                magicLink: magicLinkEnabled,
                social: socialEnabled,
            },
        };
    }

    private assertIdentifierFirstEnabled(): void {
        if (!this.getIdentifierFirstOptions().enabled) {
            throw new ForbiddenException({
                message: 'Login lookup flow is disabled',
                code: ERROR_CODES.IDENTIFIER_FIRST_DISABLED,
            });
        }
    }

    private ensureIdentifierMethodEnabled(method: IIdentifierLoginMethod): void {
        const methods = this.getIdentifierFirstOptions().methods;
        const isEnabled = method === 'password'
            ? methods.password
            : method === 'otp'
                ? methods.otp
                : method === 'magic_link'
                    ? methods.magicLink
                    : methods.social;

        if (!isEnabled) {
            throw new ForbiddenException({
                message: `${method} login method is disabled`,
                code: ERROR_CODES.IDENTIFIER_LOGIN_METHOD_DISABLED,
            });
        }
    }

    private isEmailIdentifier(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    private isPhoneIdentifier(value: string): boolean {
        return /^\+?[0-9]{6,20}$/.test(value);
    }

    private normalizeIdentifier(identifier: string): { identifier: string; identifierType: IIdentifierType } {
        const normalized = (identifier || '').trim();
        if (!normalized) {
            throw new BadRequestException({
                message: 'Identifier is required',
                code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
            });
        }

        if (this.isEmailIdentifier(normalized)) {
            return {
                identifier: normalized.toLowerCase(),
                identifierType: 'email',
            };
        }

        const normalizedPhone = normalized.replace(/\s+/g, '');
        if (this.isPhoneIdentifier(normalizedPhone)) {
            return {
                identifier: normalizedPhone,
                identifierType: 'phone',
            };
        }

        throw new BadRequestException({
            message: 'Identifier must be a valid email or phone number',
            code: ERROR_CODES.INVALID_INPUT,
        });
    }

    private async resolveTenantIdFromInput(tenantId?: string, tenantSlug?: string): Promise<string | null | undefined> {
        if (tenantId) {
            return tenantId;
        }

        if (tenantSlug) {
            const tenant = await this.tenantService.getTenantBySlug(tenantSlug);
            if (!tenant) {
                throw new BadRequestException({
                    message: 'Invalid tenant slug',
                    code: ERROR_CODES.TENANT_NOT_FOUND,
                });
            }
            return tenant.id;
        }

        return undefined;
    }

    private mapLookupTenants(users: NestAuthUser[]): IIdentifierLookupTenant[] {
        const map = new Map<string, IIdentifierLookupTenant>();
        for (const user of users) {
            if (!user.tenantId) {
                continue;
            }
            if (!map.has(user.tenantId)) {
                map.set(user.tenantId, {
                    id: user.tenantId,
                    slug: user.tenant?.slug,
                    name: user.tenant?.name,
                });
            }
        }
        return Array.from(map.values());
    }

    private getEnabledIdentifierMethods(users?: NestAuthUser[]): IIdentifierLoginMethod[] {
        const options = this.getIdentifierFirstOptions();
        const methods: IIdentifierLoginMethod[] = [];

        if (options.methods.password) {
            if (!users || users.some(user => !!user.passwordHash)) {
                methods.push('password');
            }
        }

        if (options.methods.otp) {
            methods.push('otp');
        }

        if (options.methods.magicLink) {
            methods.push('magic_link');
        }

        if (options.methods.social) {
            const hasSocialProvider = this.authProviderRegistry
                .getEnabledProviders()
                .some(provider => {
                    return (
                        provider.providerName !== EMAIL_AUTH_PROVIDER &&
                        provider.providerName !== PHONE_AUTH_PROVIDER &&
                        provider.providerName !== 'jwt'
                    );
                });

            if (hasSocialProvider) {
                methods.push('social');
            }
        }

        return methods;
    }

    private async verifyLookupToken(token: string): Promise<IdentifierLookupTokenPayload> {
        try {
            const payload = await this.jwtService.verifyIdentifierLookupToken(token) as IdentifierLookupTokenPayload;
            if (payload?.type !== 'identifier_lookup' || !payload?.identifier || !payload?.identifierType) {
                throw new UnauthorizedException({
                    message: 'Invalid lookup token',
                    code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
                });
            }
            return payload;
        } catch (error) {
            if ((error as any)?.name === 'TokenExpiredError') {
                throw new UnauthorizedException({
                    message: 'Lookup token has expired',
                    code: ERROR_CODES.LOOKUP_TOKEN_EXPIRED,
                });
            }
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException({
                message: 'Invalid lookup token',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }
    }

    private async resolveIdentifierContext(input: {
        lookupToken?: string;
        identifier?: string;
        tenantId?: string;
        tenantSlug?: string;
        guard?: string;
    }): Promise<IdentifierResolutionContext> {
        const options = this.getIdentifierFirstOptions();
        let lookupPayload: IdentifierLookupTokenPayload | null = null;

        if (input.lookupToken) {
            lookupPayload = await this.verifyLookupToken(input.lookupToken);
        } else if (options.requireLookupToken) {
            throw new UnauthorizedException({
                message: 'Lookup token is required',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        let normalizedIdentifier: { identifier: string; identifierType: IIdentifierType } | null = null;

        if (input.identifier) {
            normalizedIdentifier = this.normalizeIdentifier(input.identifier);
        } else if (lookupPayload?.identifier && lookupPayload?.identifierType) {
            normalizedIdentifier = {
                identifier: lookupPayload.identifier,
                identifierType: lookupPayload.identifierType,
            };
        }

        if (!normalizedIdentifier) {
            throw new BadRequestException({
                message: 'Identifier is required',
                code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
            });
        }

        if (
            lookupPayload?.identifier &&
            lookupPayload?.identifierType &&
            (
                normalizedIdentifier.identifier !== lookupPayload.identifier ||
                normalizedIdentifier.identifierType !== lookupPayload.identifierType
            )
        ) {
            throw new UnauthorizedException({
                message: 'Lookup token does not match identifier',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        const tenantIdFromInput = await this.resolveTenantIdFromInput(input.tenantId, input.tenantSlug);
        const tokenTenantIds = Array.isArray(lookupPayload?.tenantIds) ? lookupPayload.tenantIds : [];

        if (
            tenantIdFromInput !== undefined &&
            tokenTenantIds.length > 0 &&
            tenantIdFromInput &&
            !tokenTenantIds.includes(tenantIdFromInput)
        ) {
            throw new UnauthorizedException({
                message: 'Lookup token does not allow this tenant',
                code: ERROR_CODES.LOOKUP_TOKEN_INVALID,
            });
        }

        let tenantId = tenantIdFromInput !== undefined ? tenantIdFromInput : lookupPayload?.tenantId;

        if (
            tenantIdFromInput === undefined &&
            lookupPayload &&
            lookupPayload?.tenantIds?.length > 1 &&
            (lookupPayload.tenantId === null || lookupPayload.tenantId === undefined)
        ) {
            tenantId = undefined;
        }

        if (tenantId === undefined && options.loginMode === 'tenant-specific') {
            const defaultTenantId = await this.tenantService.resolveTenantId(null);
            if (defaultTenantId) {
                tenantId = defaultTenantId;
            }
        }

        return {
            identifier: normalizedIdentifier.identifier,
            identifierType: normalizedIdentifier.identifierType,
            tenantId,
            tenantIds: tokenTenantIds,
            guard: input.guard || lookupPayload?.guard,
        };
    }

    private async findUsersByIdentifier(
        identifier: string,
        identifierType: IIdentifierType,
        tenantId?: string | null
    ): Promise<NestAuthUser[]> {
        const where: any = identifierType === 'email'
            ? { email: identifier }
            : { phone: identifier };

        if (tenantId !== undefined) {
            where.tenantId = tenantId;
        }

        return this.userRepository.find({
            where,
            relations: ['roles', 'tenant'],
            order: {
                createdAt: 'ASC',
            },
        });
    }

    private async resolveUserFromIdentifierContext(context: IdentifierResolutionContext): Promise<NestAuthUser | null> {
        const users = await this.findUsersByIdentifier(
            context.identifier,
            context.identifierType,
            context.tenantId,
        );

        if (!users.length) {
            return null;
        }

        if (context.tenantId === undefined) {
            const uniqueTenantKeys = Array.from(new Set(users.map(user => user.tenantId || '__global__')));
            if (uniqueTenantKeys.length > 1) {
                throw new BadRequestException({
                    message: 'Tenant selection is required',
                    code: ERROR_CODES.TENANT_SELECTION_REQUIRED,
                    tenants: this.mapLookupTenants(users),
                });
            }
        }

        if (context.tenantId === undefined) {
            return users[0];
        }

        const matchedByTenant = users.find(user => user.tenantId === context.tenantId);
        return matchedByTenant || users[0];
    }

    private async completeUserLogin(
        user: NestAuthUser,
        input: any,
        provider?: BaseAuthProvider,
        guard?: string,
        skipMfa: boolean = false,
    ): Promise<AuthResponseDto> {
        if (user.isActive === false) {
            throw new UnauthorizedException({
                message: 'Your account is suspended, please contact support',
                code: ERROR_CODES.ACCOUNT_INACTIVE,
            });
        }

        const config = this.authConfigService.getConfig();
        let resolvedUser = user;

        if (config.loginHooks?.onLogin) {
            this.debugLogger.debug('Applying loginHooks.onLogin hook', 'AuthService', { userId: resolvedUser.id });
            const request = RequestContext.currentRequest();
            const modifiedUser = await config.loginHooks.onLogin(resolvedUser, input, { request, provider });
            if (modifiedUser) {
                resolvedUser = modifiedUser;
            }
        }

        resolvedUser = await this.getUserWithRolesAndPermissions(resolvedUser.id);

        let isRequiresMfa = false;
        let isTrusted = false;
        if (!skipMfa) {
            isRequiresMfa = await this.mfaService.isRequiresMfa(resolvedUser.id);
        }
        resolvedUser.isMfaEnabled = isRequiresMfa;

        if (guard && resolvedUser.roles) {
            const isExistsGuard = resolvedUser.roles.some(role => role.guard === guard);
            if (!isExistsGuard) {
                throw new UnauthorizedException({
                    message: 'Invalid credentials',
                    code: ERROR_CODES.INVALID_CREDENTIALS,
                });
            }
        }

        let session = await this.sessionManager.createSessionFromUser(resolvedUser);

        if (isRequiresMfa) {
            isTrusted = await this.checkTrustedDevice(resolvedUser);

            if (isTrusted) {
                isRequiresMfa = false;
            }

            session = await this.sessionManager.updateSession(session.id, {
                data: { ...session.data, isMfaEnabled: true, isMfaVerified: isTrusted }
            });
        }

        const tokens = await this.generateTokensFromSession(session);

        await this.eventEmitter.emitAsync(
            NestAuthEvents.LOGGED_IN,
            new UserLoggedInEvent({
                user: resolvedUser,
                tenantId: resolvedUser.tenantId,
                input,
                provider,
                session,
                tokens,
                isRequiresMfa
            })
        );

        return this.generateAuthResponse(resolvedUser, session, tokens, isRequiresMfa);
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
            tenantId: session.data?.user?.tenantId,
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

    private async generateTokensFromSession(session: NestAuthSession): Promise<AuthTokensResponseDto> {
        const payload = await this.generateTokensPayload(session);
        const tokens = await this.jwtService.generateTokens(payload);
        return tokens
    }

    private async generateAuthResponse(
        user: NestAuthUser,
        session: any, // NestAuthSession
        tokens: { accessToken: string; refreshToken: string },
        isRequiresMfa: boolean,
        trustToken?: string
    ): Promise<AuthResponseDto> {
        // Serialize user for response
        const config = this.authConfigService.getConfig();
        let serializedUser: any = user;
        if (config.user?.serialize) {
            serializedUser = await config.user.serialize(user);
        }

        // Extract role names and permissions
        const roleNames = user.roles?.map(r => r.name) || [];
        const permissions = this.extractPermissions(user);

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
                tenantId: serializedUser.tenantId,
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
