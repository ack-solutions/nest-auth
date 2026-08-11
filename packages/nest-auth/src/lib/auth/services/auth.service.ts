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
import { NestAuthVerifyRecoveryCodeRequestDto } from '../dto/requests/verify-recovery-code.request.dto';
import { INestAuthUser, ISessionUserData, NestAuthMFAMethodEnum, NestAuthOTPTypeEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { JWTTokenPayload, SessionDataPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { UserCreatedEvent } from '../../user/events/user-created.event';
import { hmacSha256Hex, timingSafeEqualHex } from '../../utils/has-token';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { LoginFailedEvent } from '../events/login-failed.event';
import { User2faVerifiedEvent } from '../events/user-2fa-verified.event';
import { MfaRecoveryCodeUsedEvent } from '../events/mfa-recovery-code-used.event';
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
import { LogoutService } from './logout.service';
import { SessionTokenService } from './session-token.service';
import { DisposableEmailService } from './disposable-email.service';
import { PasswordlessCodeRequestedEvent } from '../events/passwordless-code-requested.event';
import { chain, omit, pick } from 'lodash';
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

        private readonly logoutService: LogoutService,

        private readonly sessionTokenService: SessionTokenService,

        private readonly disposableEmail: DisposableEmailService,

        @Inject(NEST_AUTH_TENANT_CONTEXT_SERVICE)
        private readonly tenantContext: ITenantContextService,

    ) {

        this.authConfig = this.authConfigService.getConfig();
    }

    // Shared user/token/response helpers extracted to SessionTokenService
    // (Phase-2 split, #11). Kept as thin facades — public API unchanged.
    getUserWithRoles(userId: string, relations: string[] = []): Promise<NestAuthUser> {
        return this.sessionTokenService.getUserWithRoles(userId, relations);
    }

    getUserWithAccess(userId: string, tenantId: string, isPlatformAccess = false): Promise<{ user: NestAuthUser, userAccess?: NestAuthUserAccess, platformAccess?: NestAuthPlatformAccess }> {
        return this.sessionTokenService.getUserWithAccess(userId, tenantId, isPlatformAccess);
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

            // Resolve guard from config if available (Server-side enforcement)
            // Reject sign-ups from blocked/disposable email domains (opt-in).
            await this.disposableEmail.assertAllowed(input.email);

            if (this.authConfig.registrationHooks?.beforeSignup) {
                const req = RequestContext.currentRequest();
                input = await this.authConfig.registrationHooks.beforeSignup(input, { request: req });
            }

            const { email, phone, password, tenantId } = input;

            // Reject tenantId on a single-tenant deployment so misconfigured
            // clients fail loudly instead of silently writing wrong data.
            this.assertTenantIdAllowed(tenantId);

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

            // Create the user and run the onSignup hook inside ONE transaction so
            // any failure — a DB error or a throwing onSignup hook — rolls the
            // whole thing back. createUser also creates the email/phone identities
            // and default access within this same transaction, so there is no way
            // to end up with a half-created user. The USER_CREATED / REGISTERED
            // events are emitted only AFTER the transaction commits.
            //
            // Note: a hook that needs to do its own DB writes transactionally
            // should use `context.manager` (the same transactional EntityManager)
            // so its work commits or rolls back together with the user.
            const request = RequestContext.currentRequest();
            const user = await this.userService.runInTransaction(async (manager) => {
                const created = await this.userService.createUser({
                    email,
                    phone,
                    emailVerifiedAt: null,
                    phoneVerifiedAt: null,
                    password
                } as any, tenantId, input, manager);

                if (this.authConfig.registrationHooks?.onSignup) {
                    this.debugLogger.debug('Applying registrationHooks.onSignup hook', 'AuthService', { userId: created.id });
                    await this.authConfig.registrationHooks.onSignup(created, input, { request, manager });
                }

                return created;
            });

            this.debugLogger.info('User created successfully', 'AuthService', { userId: user.id, tenantId });

            // User row (+ access + identities) is committed — emit USER_CREATED now
            // (deferred from createUser because signup owned the transaction).
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_CREATED,
                new UserCreatedEvent({ user, input, tenantId }),
            );

            const { user: authUser, userAccess } = await this.getUserWithAccess(user.id, tenantId);

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
            // Platform-admin login is tenant-agnostic; nothing to validate.
            if (!isPlatformAccess) {
                this.assertTenantIdAllowed(tenantId);
            }

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

            // Resolve the already-linked identity for this validated principal.
            // The lookup key differs by provider family, so we delegate to the
            // provider instead of guessing here: first-party providers
            // (email/phone/passwordless) resolve by our `userId`, while social /
            // external providers (Google, Apple, Facebook, GitHub, jwt, custom
            // SSO) resolve by the external subject (`providerId`) — their
            // `validate().userId` is the OAuth `sub`, not our UUID, and feeding
            // that to the `uuid` userId column 500s on Postgres. See
            // `BaseAuthProvider.findLinkedIdentity` / `SocialAuthProvider`.
            const identity = await provider.findLinkedIdentity(authProviderUser);

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
            } else {
                // Provider attests this email/phone belongs to the user (e.g. Google's
                // `email_verified` claim, GitHub's verified primary email). Lift the
                // matching `*VerifiedAt` field if it isn't set yet so this becomes a
                // canonical source of "this email/phone is real and reachable".
                user = await this.applyProviderVerification(user, authProviderUser);
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

            if (guard && (platformAccess || userAccess)) {
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
            // HIPAA §164.312(b) — record failed access attempts. Emitted before
            // handleError so the audit trail captures it even if a custom
            // errorHandler transforms/re-throws.
            await this.emitLoginFailed(input, error);
            this.handleError(error, 'login');
            throw error;
        }
    }

    /** Best-effort emit of LOGIN_FAILED for the audit trail / lockout monitoring. */
    private async emitLoginFailed(input: NestAuthLoginRequestDto, error: any): Promise<void> {
        try {
            const creds: any = input?.credentials ?? {};
            const identifier = creds.email ?? creds.phone ?? creds.identifier ?? undefined;
            const req: any = RequestContext.currentRequest?.();
            const resp = error?.getResponse?.();
            // Prefer an explicit error code; otherwise derive a stable code from
            // the HTTP status so the audit trail always has a non-empty reason
            // (some providers throw string-message exceptions without a `code`).
            const status = error?.getStatus?.();
            const reasonCode =
                (typeof resp === 'object' && resp?.code) ||
                error?.code ||
                (status ? `HTTP_${status}` : 'LOGIN_FAILED');
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGIN_FAILED,
                new LoginFailedEvent({
                    identifier,
                    providerName: input?.providerName,
                    reasonCode,
                    reason: error?.message,
                    ip: req?.ip ?? req?.headers?.['x-forwarded-for'],
                    userAgent: req?.headers?.['user-agent'],
                    tenantId: input?.tenantId ?? null,
                    at: new Date(),
                }),
            );
        } catch {
            // Never let audit emission mask the original auth error.
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
                { email: emailNorm },
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
                { phone: phoneNorm },
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

    /**
     * Complete a sign-in by redeeming a single-use MFA recovery (backup) code.
     * The recovery code IS a valid second factor, so this issues a full MFA-
     * verified session — exactly like {@link verify2fa} — and, crucially, LEAVES
     * `isMfaEnabled` and the enrolled factors untouched (unlike `reset-totp`,
     * which deletes them). The now-verified session can re-enrol a fresh
     * authenticator via `setup-totp` inline, without a second sign-in.
     */
    async verifyRecoveryCode(input: NestAuthVerifyRecoveryCodeRequestDto) {
        this.debugLogger.logFunctionEntry('verifyRecoveryCode', 'AuthService', {});
        try {
            const user = await RequestContext.currentUser();
            const session = RequestContext.currentSession();

            if (!session) {
                throw new UnauthorizedException({
                    message: 'Session not found',
                    code: ERROR_CODES.SESSION_NOT_FOUND,
                });
            }

            // A recovery code is only meaningful while MFA is enabled for the user.
            const mfaEnabled = await this.mfaService.isRequiresMfa(session.userId!);
            if (!mfaEnabled) {
                throw new UnauthorizedException({
                    message: 'MFA is not enabled',
                    code: ERROR_CODES.MFA_NOT_ENABLED,
                });
            }

            const ok = await this.mfaService.verifyAndConsumeRecoveryCode(session.userId!, input.code);
            if (!ok) {
                throw new UnauthorizedException({
                    message: 'Invalid recovery code',
                    code: ERROR_CODES.MFA_RECOVERY_CODE_INVALID,
                });
            }

            // Recovery code proved the second factor → mark the session MFA-verified.
            const payload = await this.sessionManager.updateSession(session.id!, {
                data: {
                    ...session.data!,
                    isMfaVerified: true,
                },
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
                return null;
            }

            await this.eventEmitter.emitAsync(
                NestAuthEvents.MFA_RECOVERY_CODE_USED,
                new MfaRecoveryCodeUsedEvent({
                    user,
                    tenantId: payload.data?.tenantId ?? null,
                    session: payload,
                    tokens,
                }),
            );

            this.debugLogger.logFunctionExit('verifyRecoveryCode', 'AuthService', { userId: user.id });
            return this.generateAuthResponse(user, payload, tokens, false, trustToken);

        } catch (error) {
            this.debugLogger.logError(error, 'verifyRecoveryCode', {});
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

        // Guard 1: refuse on single-tenant deployments — silently switching
        // (the previous behaviour) misled clients into thinking the call worked.
        if (!this.authConfig.tenant?.enabled) {
            throw new BadRequestException({
                message: 'Multi-tenancy is disabled on this deployment.',
                code: ERROR_CODES.TENANT_SWITCHING_DISABLED,
            });
        }

        // Guard 2: in ISOLATED mode each tenant has its own user identity, so
        // mid-session tenant switching is semantically wrong — the user should
        // sign in to the target tenant directly.
        const tenantMode = this.authConfig.tenant?.mode ?? TenantModeEnum.ISOLATED;
        if (tenantMode === TenantModeEnum.ISOLATED) {
            throw new BadRequestException({
                message: 'Tenant switching is not supported in isolated mode. Sign in to the target tenant directly.',
                code: ERROR_CODES.TENANT_SWITCHING_NOT_SUPPORTED,
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

        // Guard 3: confirm the caller actually has access to the target tenant
        // before binding the session to it.
        if (resolvedTenantId && !userAccess) {
            const platformAccess = await NestAuthPlatformAccess.findOne({
                where: { userId: user.id, isActive: true },
            });
            if (!platformAccess) {
                throw new ForbiddenException({
                    message: 'You do not have access to that tenant.',
                    code: ERROR_CODES.NOT_A_MEMBER_OF_TENANT,
                });
            }
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

    async getSessionUserData(): Promise<ISessionUserData<any>> {
        const session = RequestContext.currentSession();
        const tenantId = RequestContext.currentTenantId();

        const isPlatformAccess = await AccessRoleResolver.isPlatformAccess();
        const { user, userAccess, platformAccess } = await this.getUserWithAccess(session.userId!, tenantId, isPlatformAccess);

        let rolesWithPermissions = []
        if(isPlatformAccess) {
            rolesWithPermissions = platformAccess?.roles ?? [];
        } else {
            rolesWithPermissions = userAccess?.roles ?? [];
        }
        const permissions = chain(rolesWithPermissions)
            .map((role) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();

        const userRoles = rolesWithPermissions.map((role) => pick(role, ['id', 'name', 'guard']));

        const config = this.authConfigService.getConfig();

        let serializedUser = {};
        if (config.user?.getSessionUserData) {
            serializedUser = await config.user.getSessionUserData(user);
        } 
        
        return {
            ...pick(user, ['id', 'email', 'phone', 'emailVerifiedAt', 'phoneVerifiedAt','isMfaEnabled', 'metadata', 'mustChangePassword']),
            ...(serializedUser || {}),
            roles: userRoles,
            permissions,
        };
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

        // Tenant-scope the lookup so a social login in one tenant can't resolve or
        // link a user owned by another tenant (matches findIdentity's scoping).
        const scopedWhere = {
            [linkUserWith]: linkUserValue,
            ...(tenantId ? { userAccesses: { tenantId: Equal(tenantId) } } : {}),
        };

        let user = await this.userRepository.findOne({ where: scopedWhere });

        if (user) {
            // Account-linking guard: attaching a NEW social identity to an EXISTING
            // account by email is an account-takeover vector unless the provider
            // actually verified the email — otherwise anyone who can make a provider
            // assert someone else's unverified address inherits their account.
            const config = this.authConfigService.getConfig();
            const requireVerifiedForLinking = config.social?.requireVerifiedEmailForLinking !== false;
            if (linkUserWith === 'email' && requireVerifiedForLinking && providerUser.emailVerified !== true) {
                throw new UnauthorizedException({
                    message:
                        'An account already exists for this email. Sign in with your existing method, ' +
                        'then link this provider from your account settings.',
                    code: ERROR_CODES.SOCIAL_EMAIL_NOT_VERIFIED,
                });
            }
        } else {
            // Brand-new account. Only mark the contact verified when the provider
            // actually proved it — do NOT blanket-stamp emailVerifiedAt.
            const createData: Record<string, any> = {
                [linkUserWith]: linkUserValue,
                metadata: providerUser.metadata || {},
            };
            if (linkUserWith === 'email') {
                createData.emailVerifiedAt = providerUser.emailVerified === true ? new Date() : null;
            } else if (linkUserWith === 'phone') {
                createData.phoneVerifiedAt = providerUser.phoneVerified === true ? new Date() : null;
            }

            // Create new user via UserService to ensure hooks and events are triggered
            try {
                const meta = providerUser.metadata ?? {};
                user = await this.userService.createUser(
                    createData as any,
                    tenantId,
                    {
                        [linkUserWith]: linkUserValue,
                        // Prefer the frontend-supplied firstName/lastName (needed for
                        // Apple, which only returns the name on first sign-in); fall
                        // back to splitting a full `name` from the provider token.
                        firstName: meta.firstName ?? (meta.name ?? '').split(' ')[0],
                        lastName: meta.lastName ?? (meta.name ?? '').split(' ').slice(1).join(' '),
                        // Explicit avatarUrl wins; Google exposes `picture` as a fallback.
                        avatarUrl: meta.avatarUrl ?? meta.picture,
                        ...providerUser,
                        provider: provider.providerName,
                        description: 'Social login auto-creation'
                    }
                );
            } catch (error) {
                // Handle race condition: user might have been created by another process
                if (error instanceof ConflictException || error.status === 409) {
                    user = await this.userRepository.findOne({ where: scopedWhere });
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

            // Rotation / reuse detection: the session stores a hash of the
            // CURRENT refresh token. A token that doesn't match has already been
            // rotated (replayed) and is rejected. Legacy sessions created before
            // rotation have an empty hash — we skip the check and this refresh
            // populates it going forward.
            const storedRefreshHash = (session as any).refreshToken as string | undefined;
            if (storedRefreshHash) {
                const secret = this.authConfig.session?.jwt?.secret ?? '';
                if (!timingSafeEqualHex(storedRefreshHash, hmacSha256Hex(secret, refreshToken))) {
                    // REUSE DETECTED: an already-rotated refresh token is being
                    // replayed — a strong theft signal. We can't tell the attacker
                    // from the victim, so by default we revoke the whole session
                    // (kill the token family): this ejects a thief holding a stolen
                    // token, at the cost of the legitimate user re-authenticating.
                    // Only that one session is revoked (other devices are untouched).
                    const revoke = this.authConfig.session?.refreshTokenReuse?.revokeSession !== false;
                    if (revoke) {
                        await this.sessionManager.revokeSession(session.id, 'security');
                    }
                    // Emit for alerting/audit; never let a listener break the flow.
                    await this.eventEmitter
                        .emitAsync(NestAuthEvents.REFRESH_TOKEN_REUSE_DETECTED, {
                            sessionId: session.id,
                            userId: session.userId,
                            revoked: revoke,
                        })
                        .catch(() => undefined);
                    throw new UnauthorizedException({
                        message: 'Refresh token is no longer valid (rotated or replayed)',
                        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
                    });
                }
            }

            const { user, userAccess, platformAccess } = await this.getUserWithAccess(session.userId!, session.data?.tenantId ?? null, isPlatformAccess);

            if (!user) {
                await this.sessionManager.revokeSession(session.id, 'security');
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            if (user.isActive === false) {
                await this.sessionManager.revokeSession(session.id, 'security');
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
                    await this.sessionManager.revokeSession(session.id, 'security');
                    throw error;
                }
            }
            if (isPlatformAccess && !platformAccess) {
                await this.sessionManager.revokeSession(session.id, 'security');
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

    // Logout logic extracted to LogoutService (Phase-2 god-service split).
    // These remain as thin facades so the public AuthService API is unchanged.
    async logout(logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        return this.logoutService.logout(logoutType, reason);
    }

    async logoutAll(userId: string, logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        return this.logoutService.logoutAll(userId, logoutType, reason);
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

    // generateTokensPayload moved to SessionTokenService (#11).

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

    // generateTokensFromSession + generateAuthResponse moved to SessionTokenService
    // (#11). Kept as thin facades — public API unchanged.
    async generateTokensFromSession(session: NestAuthSession): Promise<AuthTokensResponseDto> {
        return this.sessionTokenService.generateTokensFromSession(session);
    }

    async generateAuthResponse(
        user: NestAuthUser,
        session: any, // NestAuthSession
        tokens: { accessToken: string; refreshToken: string },
        isRequiresMfa: boolean,
        trustToken?: string,
    ): Promise<AuthResponseDto> {
        return this.sessionTokenService.generateAuthResponse(user, session, tokens, isRequiresMfa, trustToken);
    }

    /**
     * Lift `emailVerifiedAt` / `phoneVerifiedAt` on an existing user when the
     * provider attests that the contact channel belongs to them, but only if
     * the matching value on the user matches what the provider returned and
     * isn't already verified. Skips silently when nothing to do.
     *
     * Returns the (possibly updated) user. The reload is needed because the
     * cached `identity.user` may not have the freshest fields.
     */
    private async applyProviderVerification(
        user: NestAuthUser,
        providerUser: AuthProviderUser,
    ): Promise<NestAuthUser> {
        const updates: Partial<NestAuthUser> = {};

        if (
            providerUser.emailVerified === true &&
            !user.emailVerifiedAt &&
            user.email &&
            providerUser.email &&
            user.email.toLowerCase() === providerUser.email.toLowerCase()
        ) {
            updates.emailVerifiedAt = new Date();
        }

        if (
            providerUser.phoneVerified === true &&
            !user.phoneVerifiedAt &&
            user.phone &&
            providerUser.phone &&
            user.phone === providerUser.phone
        ) {
            updates.phoneVerifiedAt = new Date();
        }

        if (Object.keys(updates).length === 0) {
            return user;
        }

        await this.userRepository.update({ id: user.id }, updates);
        return (await this.userRepository.findOne({ where: { id: user.id } })) ?? user;
    }

    /**
     * Reject a request that supplies a `tenantId` on a deployment where
     * multi-tenancy is disabled. Without this, the value is silently dropped
     * — clients built against a multi-tenant deployment that get repointed
     * at a single-tenant one would think their tenant scoping was working.
     */
    private assertTenantIdAllowed(tenantId?: string | null): void {
        if (!this.authConfig.tenant?.enabled && tenantId) {
            throw new BadRequestException({
                message: 'tenantId provided but multi-tenancy is disabled on this deployment.',
                code: ERROR_CODES.TENANT_NOT_ENABLED,
            });
        }
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
