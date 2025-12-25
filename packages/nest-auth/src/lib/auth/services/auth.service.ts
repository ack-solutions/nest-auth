import {
    Injectable, UnauthorizedException, BadRequestException,
    ConflictException,
    ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { OTPTypeEnum } from '../../core/interfaces/otp.interface';
import {
    EMAIL_AUTH_PROVIDER,
    PHONE_AUTH_PROVIDER,
    ERROR_CODES,
    NestAuthEvents,
    NEST_AUTH_TRUST_DEVICE_KEY,
} from '../../auth.constants';
import { MoreThan } from 'typeorm';
import { MfaService } from './mfa.service';
import { JwtService } from '../../core/services/jwt.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { RequestContext } from '../../request-context/request-context';
import { SignupRequestDto } from '../dto/requests/signup.request.dto';
import { AuthResponseDto } from '../dto/responses/auth.response.dto';
import { LoginRequestDto } from '../dto/requests/login.request.dto';
import { Verify2faRequestDto } from '../dto/requests/verify-2fa.request.dto';
import {
    MFAMethodEnum,
    MFAOptions
} from '../../core/interfaces/mfa-options.interface';
import { JWTTokenPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
import { ForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
import { generateOtp } from '../../utils/otp';
import { ResetPasswordRequestDto } from '../dto/requests/reset-password.request.dto';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { User2faVerifiedEvent } from '../events/user-2fa-verified.event';
import { UserRefreshTokenEvent } from '../events/user-refresh-token.event';
import { LoggedOutEvent } from '../events/logged-out.event';
import { LoggedOutAllEvent } from '../events/logged-out-all.event';
import { PasswordResetRequestedEvent } from '../events/password-reset-requested.event';
import { PasswordResetEvent } from '../events/password-reset.event';
import { AuthProviderUser, BaseAuthProvider } from '../../core/providers/base-auth.provider';
import { AuthProviderRegistryService } from '../../core/services/auth-provider-registry.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import moment from 'moment';
import { VerifyForgotPasswordOtpRequestDto } from '../dto/requests/verify-forgot-password-otp-request-dto';
import { ResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';
import { ChangePasswordRequestDto } from '../dto/requests/change-password.request.dto';
import { VerifyOtpResponseDto } from '../dto/responses/verify-otp.response.dto';
import { SendEmailVerificationRequestDto } from '../dto/requests/send-email-verification.request.dto';
import { VerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { CookieHelper } from '../../utils/cookie.helper';
import { UserPasswordChangedEvent } from '../events/user-password-changed.event';
import { NestAuthSession } from '../../session/entities/session.entity';
import { AuthTokensResponseDto } from '../dto/responses/auth.response.dto';
import { UserService } from '../../user/services/user.service';
import ms from 'ms';


@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthOTP)
        private otpRepository: Repository<NestAuthOTP>,

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


    get mfaConfig(): MFAOptions {
        return AuthConfigService.getOptions().mfa || {};
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

    async signup(input: SignupRequestDto): Promise<AuthResponseDto> {
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

            user = await this.getUserWithRolesAndPermissions(user.id);

            // Link user to all enabled providers
            for (const item of providersToLink) {
                this.debugLogger.debug('Linking user to provider', 'AuthService', { userId: user.id, providerName: item.provider.providerName });
                // Note: UserService might have already created the identity, but we ensure it's linked here
                await item.provider.linkToUser(user.id, item.userId);
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
            let response: AuthResponseDto = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                isRequiresMfa: isRequiresMfa,
            };

            // Add MFA methods if MFA is required
            if (isRequiresMfa) {
                const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
                response.mfaMethods = enabledMethods;
                const defaultMethod = this.mfaService.mfaConfig?.defaultMethod || enabledMethods[0];
                response.defaultMfaMethod = defaultMethod;
            }

            // Apply auth.transformResponse hook if configured
            if (config.auth?.transformResponse) {
                response = await config.auth.transformResponse(response, user, session);
            }

            return response;

        } catch (error) {
            this.debugLogger.logError(error, 'signup', { email: input.email, phone: input.phone });
            this.handleError(error, 'signup');
            throw error;
        }
    }

    async login(input: LoginRequestDto): Promise<AuthResponseDto> {
        const { credentials, providerName, createUserIfNotExists = false } = input;
        this.debugLogger.logFunctionEntry('login', 'AuthService', { providerName, createUserIfNotExists });
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
                user = await this.handleSocialLogin(provider, authProviderUser, tenantId);
            }

            if (user.isActive === false) {
                throw new UnauthorizedException({
                    message: 'Your account is suspended, please contact support',
                    code: ERROR_CODES.ACCOUNT_INACTIVE,
                });
            }

            user = await this.getUserWithRolesAndPermissions(user.id);


            let isRequiresMfa = false
            // Skip MFA for social login providers as they are considered trusted/direct login
            if (!provider.skipMfa) {
                isRequiresMfa = await this.mfaService.isRequiresMfa(user.id);
            }
            user.isMfaEnabled = isRequiresMfa;

            let session = await this.sessionManager.createSessionFromUser(user);

            // Check for trusted device cookie or header if MFA is required
            if (isRequiresMfa) {
                const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
                const req = RequestContext.currentRequest();
                let trustToken = CookieHelper.get(req, trustCookieName);

                // If not in cookie, check header
                if (!trustToken) {
                    trustToken = req.headers[trustCookieName] as string;
                }
                let isTrusted = false;
                if (trustToken) {
                    isTrusted = await this.mfaService.validateTrustedDevice(user.id, trustToken);
                    if (isTrusted) {
                        isRequiresMfa = false;
                        // Update session to indicate MFA is verified by trust
                        session = await this.sessionManager.updateSession(session.id, {
                            data: { ...session.data, isMfaVerified: true }
                        });
                    }
                }

                // Set Mfa enbale if requred for user, set in properly in session
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
                    tenantId: user.tenantId,
                    input,
                    provider,
                    session,
                    tokens,
                    isRequiresMfa
                })
            );

            // Build default response
            let response: AuthResponseDto = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                isRequiresMfa: isRequiresMfa,
            };

            // Add MFA methods if MFA is required
            if (isRequiresMfa) {
                const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
                response.mfaMethods = enabledMethods;
                // Set default method from config or first available method
                const defaultMethod = this.mfaService.mfaConfig?.defaultMethod || enabledMethods[0];
                response.defaultMfaMethod = defaultMethod;
            }

            // Apply auth.transformResponse hook if configured
            const config = this.authConfigService.getConfig();
            if (config.auth?.transformResponse) {
                response = await config.auth.transformResponse(response, user, session);
            }

            return response;
        } catch (error) {
            this.debugLogger.logError(error, 'login', { providerName, createUserIfNotExists });
            this.handleError(error, 'login');
            throw error;
        }
    }

    async verify2fa(input: Verify2faRequestDto) {
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
            const isValid = await this.mfaService.verifyMfa(session.userId, input.otp, input.method);
            if (!isValid) {
                this.debugLogger.warn('Invalid MFA code provided', 'AuthService', { userId: session.userId, method: input.method });
                throw new UnauthorizedException({
                    message: 'Invalid MFA code',
                    code: ERROR_CODES.MFA_CODE_INVALID,
                });
            }

            this.debugLogger.debug('Updating session with MFA verification', 'AuthService', { sessionId: session.id });
            const payload = await this.sessionManager.updateSession(session.id, {
                data: {
                    ...session.data,
                    isMfaVerified: true,
                }
            });
            const tokens = await this.generateTokensFromSession(payload);

            let trustToken: string | undefined;
            if (input.rememberDevice) {
                const req = RequestContext.currentRequest();
                const userAgent = req.headers['user-agent'] || '';
                const ip = req.ip || req.socket.remoteAddress || '';
                trustToken = await this.mfaService.createTrustedDevice(session.userId, userAgent, ip);
            }

            const user = await this.getUser();

            // Emit 2FA verified event
            this.debugLogger.debug('Emitting 2FA verified event', 'AuthService', { userId: user.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_VERIFIED,
                new User2faVerifiedEvent({
                    user: user as NestAuthUser,
                    tenantId: user.tenantId,
                    input,
                    session,
                    tokens
                })
            );

            this.debugLogger.logFunctionExit('verify2fa', 'AuthService', { userId: user.id });
            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                trustToken,
            };

        } catch (error) {
            this.debugLogger.logError(error, 'verify2fa', { method: input.method });
            this.handleError(error, 'mfa');
            throw error;
        }
    }

    async send2faCode(userId: string, method: MFAMethodEnum) {
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


    async changePassword(input: ChangePasswordRequestDto): Promise<AuthResponseDto> {
        this.debugLogger.logFunctionEntry('changePassword', 'AuthService');

        try {
            const currentUser = RequestContext.currentUser();

            if (!currentUser?.id) {
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            const user = await this.userRepository.findOne({
                where: { id: currentUser.id },
            });

            if (!user) {
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            const isValid = await user.validatePassword(input.currentPassword);
            if (!isValid) {
                throw new BadRequestException({
                    message: 'Current password is incorrect',
                    code: ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
                });
            }

            if (input.currentPassword === input.newPassword) {
                throw new BadRequestException({
                    message: 'New password must be different from the current password',
                    code: ERROR_CODES.NEW_PASSWORD_SAME_AS_CURRENT,
                });
            }

            await user.setPassword(input.newPassword);
            await this.userRepository.save(user);

            await this.sessionManager.revokeAllUserSessions(user.id);

            const hydratedUser = await this.getUserWithRolesAndPermissions(user.id);
            const session = await this.sessionManager.createSessionFromUser(hydratedUser);
            const tokens = await this.generateTokensFromSession(session);
            const isRequiresMfa = await this.mfaService.isRequiresMfa(user.id);

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_CHANGED,
                new UserPasswordChangedEvent({
                    user,
                    initiatedBy: 'user'
                })
            );

            this.debugLogger.logFunctionExit('changePassword', 'AuthService', { userId: user.id });
            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                isRequiresMfa,
            };
        } catch (error) {
            this.debugLogger.logError(error, 'changePassword');
            this.handleError(error, 'password_change');
            throw error;
        }
    }

    async forgotPassword(input: ForgotPasswordRequestDto) {
        this.debugLogger.logFunctionEntry('forgotPassword', 'AuthService', { email: input.email, phone: input.phone });

        try {
            const { email, phone } = input;
            let { tenantId = null } = input;

            // Resolve tenant ID - use provided or default
            tenantId = await this.tenantService.resolveTenantId(tenantId);
            let provider: BaseAuthProvider | null = null;

            if (phone) {
                provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
            } else if (email) {
                provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
            } else {
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            if (!provider) {
                throw new BadRequestException({
                    message: 'Phone or email authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }

            if (!provider.enabled) {
                if (email) {
                    throw new BadRequestException({
                        message: 'Email authentication is not enabled',
                        code: ERROR_CODES.PROVIDER_NOT_FOUND,
                    });
                } else if (phone) {
                    throw new BadRequestException({
                        message: 'Phone authentication is not enabled',
                        code: ERROR_CODES.PROVIDER_NOT_FOUND,
                    });
                }
            }

            const identity = await provider.findIdentity(email || phone);

            if (!identity) {
                // Return success even if user not found to prevent email/phone enumeration
                return { message: 'If the account exists, a password reset code has been sent' };
            }

            const options = AuthConfigService.getOptions();
            let code: string;
            // Apply otp.generate hook if configured
            if (options.otp?.generate) {
                code = await options.otp.generate(this.mfaConfig.otpLength);
            } else {
                code = generateOtp(this.mfaConfig.otpLength);
            }

            let expiresAtMs: number;
            if (typeof this.mfaConfig.otpExpiresIn === 'string') {
                expiresAtMs = ms(this.mfaConfig.otpExpiresIn); // example: '15m', '1h', '1d'
            } else {
                expiresAtMs = this.mfaConfig.otpExpiresIn || 900000; // Default to 15m if undefined
            }

            if (!expiresAtMs || isNaN(expiresAtMs) || expiresAtMs <= 0) {
                throw new Error(`Invalid MFA configuration: otpExpiresIn '${this.mfaConfig.otpExpiresIn}' results in invalid duration`);
            }

            // Invalidate previous MFA OTPs for this user
            await this.otpRepository.delete({
                userId: identity.user?.id,
                type: OTPTypeEnum.PASSWORD_RESET
            });

            // // Generate OTP
            // const otp = generateOtp();
            // const expiresAt = new Date();
            // expiresAt.setMinutes(expiresAt.getMinutes() + this.mfaConfig.otpExpiresIn); // OTP expires in 15 minutes

            // Save OTP to database
            const otpEntity = await this.otpRepository.create({
                userId: identity.user?.id,
                type: OTPTypeEnum.PASSWORD_RESET,
                expiresAt: new Date(Date.now() + expiresAtMs),
                code,
            });
            await this.otpRepository.save(otpEntity);

            // Emit refresh token event, Send OTP via email or SMS should be handled by the event listener
            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_RESET_REQUESTED,
                new PasswordResetRequestedEvent({
                    user: identity.user,
                    tenantId: identity.user?.tenantId,
                    input,
                    otp: otpEntity,
                    provider,
                })
            );

            this.debugLogger.logFunctionExit('forgotPassword', 'AuthService', { email: !!email, phone: !!phone });
            return true;

        } catch (error) {
            this.debugLogger.logError(error, 'forgotPassword', { email: input.email, phone: input.phone });
            this.handleError(error, 'password_reset');
            throw error;
        }
    }

    async verifyForgotPasswordOtp(input: VerifyForgotPasswordOtpRequestDto): Promise<VerifyOtpResponseDto> {
        this.debugLogger.logFunctionEntry('verifyForgotPasswordOtp', 'AuthService', { email: input.email, phone: input.phone });
        try {
            const { email, phone, otp } = input;
            let { tenantId = null } = input;

            // Resolve tenant ID - use provided or default
            tenantId = await this.tenantService.resolveTenantId(tenantId);

            if (!email && !phone) {
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            let provider: BaseAuthProvider | null = null;

            if (phone) {
                provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
            } else if (email) {
                provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);
            }

            if (!provider) {
                throw new BadRequestException({
                    message: 'Phone or email authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }

            const identity = await provider.findIdentity(email || phone);

            if (!identity) {
                throw new BadRequestException({
                    message: 'Invalid reset request',
                    code: ERROR_CODES.PASSWORD_RESET_INVALID_REQUEST,
                });
            }

            const validOtp = await this.otpRepository.findOne({
                where: {
                    userId: identity.user?.id,
                    code: otp,
                    type: OTPTypeEnum.PASSWORD_RESET,
                    used: false
                },
                relations: ['user']
            });

            if (!validOtp) {
                throw new BadRequestException({
                    message: 'Invalid OTP code',
                    code: ERROR_CODES.OTP_INVALID,
                });
            }
            if (moment(validOtp.expiresAt).isBefore(new Date())) {
                throw new BadRequestException({
                    message: 'OTP code expired',
                    code: ERROR_CODES.OTP_EXPIRED,
                });
            }

            const user = validOtp.user;

            // Generate JWT-based password reset token
            // Include password hash prefix to invalidate token if password changes
            const passwordHashPrefix = user.passwordHash ? user.passwordHash.substring(0, 10) : '';
            const resetToken = await this.jwtService.generatePasswordResetToken({
                userId: user.id,
                passwordHashPrefix,
                type: 'password-reset'
            });

            // Delete the OTP since it's been verified
            await this.otpRepository.remove(validOtp);

            this.debugLogger.logFunctionExit('verifyForgotPasswordOtp', 'AuthService', { email: input.email, phone: input.phone });
            return {
                message: 'OTP verified successfully',
                resetToken
            };
        } catch (error) {
            this.debugLogger.logError(error, 'verifyForgotPasswordOtp', { email: input.email, phone: input.phone });
            this.handleError(error, 'password_reset');
            throw error;
        }
    }

    async resetPassword(input: ResetPasswordRequestDto) {
        this.debugLogger.logFunctionEntry('resetPassword', 'AuthService', { email: input.email, phone: input.phone });

        try {
            const { email, phone, otp, newPassword } = input;
            let { tenantId = null } = input;

            // Resolve tenant ID - use provided or default
            tenantId = await this.tenantService.resolveTenantId(tenantId);

            if (!email && !phone) {
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            // Find user by email or phone
            const user = await this.userRepository.findOne({
                where: [
                    ...(email ? [{ email, tenantId }] : []),
                    ...(phone ? [{ phone, tenantId }] : [])
                ]
            });

            if (!user) {
                throw new BadRequestException({
                    message: 'Invalid reset request',
                    code: ERROR_CODES.PASSWORD_RESET_INVALID_REQUEST,
                });
            }

            // Find valid OTP
            const validOtp = await this.otpRepository.findOne({
                where: {
                    userId: user.id,
                    code: otp,
                    type: OTPTypeEnum.PASSWORD_RESET,
                    expiresAt: MoreThan(new Date()),
                    used: false
                }
            });

            if (!validOtp) {
                throw new BadRequestException({
                    message: 'Invalid or expired OTP',
                    code: ERROR_CODES.OTP_INVALID,
                });
            }

            // Update password
            await user.setPassword(newPassword);
            await this.userRepository.save(user);

            // Mark OTP as used
            validOtp.used = true;
            await this.otpRepository.save(validOtp);

            // Emit refresh token event, If we want to send email or SMS should be handled by the event listener
            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_RESET,
                new PasswordResetEvent({
                    user,
                    tenantId: user.tenantId,
                    input,
                })
            );

            this.debugLogger.logFunctionExit('resetPassword', 'AuthService', { email: !!email, phone: !!phone });
            return true;

        } catch (error) {
            this.debugLogger.logError(error, 'resetPassword', { email: input.email, phone: input.phone });
            this.handleError(error, 'password_reset');
            throw error;
        }
    }


    async resetPasswordWithToken(input: ResetPasswordWithTokenRequestDto) {
        this.debugLogger.logFunctionEntry('resetPasswordWithToken', 'AuthService', { token: '***' });

        try {
            const { token, newPassword } = input;

            // Verify JWT token
            let decoded: any;
            try {
                decoded = await this.jwtService.verifyPasswordResetToken(token);
            } catch (error) {
                throw new BadRequestException({
                    message: 'Invalid or expired reset token',
                    code: ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
                });
            }

            if (decoded.type !== 'password-reset') {
                throw new BadRequestException({
                    message: 'Invalid token type',
                    code: ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
                });
            }

            // Get user
            const user = await this.userRepository.findOne({
                where: { id: decoded.userId }
            });

            if (!user) {
                throw new BadRequestException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            // Verify password hasn't changed since token was issued
            // This makes the token single-use in practice
            const currentPasswordHashPrefix = user.passwordHash ? user.passwordHash.substring(0, 10) : '';
            if (decoded.passwordHashPrefix !== currentPasswordHashPrefix) {
                throw new BadRequestException({
                    message: 'Reset token is no longer valid',
                    code: ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
                });
            }

            // Update password
            await user.setPassword(newPassword);
            await this.userRepository.save(user);

            // Emit password reset event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_RESET,
                new PasswordResetEvent({
                    user,
                    tenantId: user.tenantId,
                    input: { token, newPassword } as any,
                })
            );

            this.debugLogger.logFunctionExit('resetPasswordWithToken', 'AuthService');
            return true;

        } catch (error) {
            this.debugLogger.logError(error, 'resetPasswordWithToken');
            this.handleError(error, 'password_reset');
            throw error;
        }
    }

    async logout(logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        const session = RequestContext.currentSession();

        const user = await this.getUser();

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

        if (session) {
            await this.sessionManager.revokeSession(session.id);
        }

        return true;
    }

    async logoutAll(userId: string, logoutType: 'user' | 'admin' | 'system' = 'user', reason?: string) {
        const session = RequestContext.currentSession();
        if (!session) {
            throw new UnauthorizedException({
                message: 'Session not found',
                code: ERROR_CODES.SESSION_NOT_FOUND,
            });
        }

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
                    currentSessionId: session.id,
                    sessions,
                })
            );
        }

        return true;
    }

    async sendEmailVerification(input: SendEmailVerificationRequestDto) {
        this.debugLogger.logFunctionEntry('sendEmailVerification', 'AuthService');

        try {
            const user = RequestContext.currentUser();
            if (!user) {
                throw new UnauthorizedException({
                    message: 'User not authenticated',
                    code: ERROR_CODES.UNAUTHORIZED,
                });
            }

            const fullUser = await this.getUserWithRolesAndPermissions(user.id);

            if (!fullUser.email) {
                throw new BadRequestException({
                    message: 'User does not have an email address',
                    code: ERROR_CODES.NO_EMAIL_ADDRESS,
                });
            }

            if (fullUser.emailVerifiedAt) {
                throw new BadRequestException({
                    message: 'Email is already verified',
                    code: ERROR_CODES.EMAIL_ALREADY_VERIFIED,
                });
            }

            // Generate OTP
            const otp = generateOtp();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 30); // OTP expires in 30 minutes

            // Save OTP to database
            const otpEntity = await this.otpRepository.save({
                userId: fullUser.id,
                code: otp,
                expiresAt,
                type: OTPTypeEnum.VERIFICATION
            });

            // Emit email verification event - email sending should be handled by event listener
            await this.eventEmitter.emitAsync(
                NestAuthEvents.EMAIL_VERIFICATION_REQUESTED,
                {
                    user: fullUser,
                    tenantId: fullUser.tenantId,
                    otp: otpEntity,
                }
            );

            this.debugLogger.logFunctionExit('sendEmailVerification', 'AuthService');
            return { message: 'Verification email sent successfully' };

        } catch (error) {
            this.debugLogger.logError(error, 'sendEmailVerification');
            this.handleError(error, 'signup'); // Assuming email verification is part of signup flow or user profile management
            throw error;
        }
    }

    async verifyEmail(input: VerifyEmailRequestDto) {
        this.debugLogger.logFunctionEntry('verifyEmail', 'AuthService');

        try {
            const user = RequestContext.currentUser();
            if (!user) {
                throw new UnauthorizedException({
                    message: 'User not authenticated',
                    code: ERROR_CODES.UNAUTHORIZED,
                });
            }

            const fullUser = await this.getUserWithRolesAndPermissions(user.id);

            if (!fullUser.email) {
                throw new BadRequestException({
                    message: 'User does not have an email address',
                    code: ERROR_CODES.NO_EMAIL_ADDRESS,
                });
            }

            if (fullUser.emailVerifiedAt) {
                throw new BadRequestException({
                    message: 'Email is already verified',
                    code: ERROR_CODES.EMAIL_ALREADY_VERIFIED,
                });
            }

            // Find valid OTP
            const validOtp = await this.otpRepository.findOne({
                where: {
                    userId: fullUser.id,
                    code: input.otp,
                    type: OTPTypeEnum.VERIFICATION,
                    used: false
                }
            });

            if (!validOtp) {
                throw new BadRequestException({
                    message: 'Invalid verification code',
                    code: ERROR_CODES.VERIFICATION_CODE_INVALID,
                });
            }

            if (moment(validOtp.expiresAt).isBefore(new Date())) {
                throw new BadRequestException({
                    message: 'Verification code has expired',
                    code: ERROR_CODES.VERIFICATION_CODE_EXPIRED,
                });
            }

            // Mark OTP as used
            validOtp.used = true;
            await this.otpRepository.save(validOtp);

            // Verify user email
            fullUser.emailVerifiedAt = new Date();
            fullUser.isVerified = true;
            await this.userRepository.save(fullUser);

            // Emit email verified event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.EMAIL_VERIFIED,
                {
                    user: fullUser,
                    tenantId: fullUser.tenantId,
                }
            );

            this.debugLogger.logFunctionExit('verifyEmail', 'AuthService');
            return { message: 'Email verified successfully' };

        } catch (error) {
            this.debugLogger.logError(error, 'verifyEmail');
            this.handleError(error, 'signup'); // Assuming email verification is part of signup flow or user profile management
            throw error;
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
            roles: session.data?.roles,
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
}
