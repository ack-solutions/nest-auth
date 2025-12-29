import { Injectable, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { JWTTokenPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
import {
    EMAIL_AUTH_PROVIDER,
    PHONE_AUTH_PROVIDER,
    ERROR_CODES,
    NestAuthEvents,
} from '../../auth.constants';
import { JwtService } from '../../core/services/jwt.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { RequestContext } from '../../request-context/request-context';
import { AuthResponseDto } from '../dto/responses/auth.response.dto';
import { AuthTokensResponseDto } from '../dto/responses/auth.response.dto';
import { NestAuthForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
import { generateOtp } from '../../utils/otp';
import { UserPasswordChangedEvent } from '../events/user-password-changed.event';
import { PasswordResetRequestedEvent } from '../events/password-reset-requested.event';
import { PasswordResetEvent } from '../events/password-reset.event';
import { AuthProviderRegistryService } from '../../core/services/auth-provider-registry.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import moment from 'moment';
import { NestAuthVerifyForgotPasswordOtpRequestDto } from '../dto/requests/verify-forgot-password-otp-request-dto';
import { NestAuthResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';
import { NestAuthChangePasswordRequestDto } from '../dto/requests/change-password.request.dto';
import { VerifyOtpResponseDto } from '../dto/responses/verify-otp.response.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { MfaService } from './mfa.service';
import ms from 'ms';
import { BaseAuthProvider } from '../../core/providers/base-auth.provider';

@Injectable()
export class PasswordService {

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
    ) { }

    get mfaConfig() {
        return AuthConfigService.getOptions().mfa || {};
    }

    private handleError(error: Error, context: 'password_reset' | 'password_change') {
        const config = this.authConfigService.getConfig();
        if (config.errorHandler) {
            const result = config.errorHandler(error, context);
            if (result) {
                throw result;
            }
        }
    }

    // Note: This method generates tokens, might need duplication from AuthService or shared TokenService
    // For now we duplicate generateTokensFromSession logic partially or inject AuthService?
    // Using simple version here to avoid circular dependency if possible, or we will need TokenService.
    // Ideally AuthService should use PasswordService, so PasswordService cannot use AuthService.
    // We will need to extract Token Logic or duplicate it for now.
    // Let's assume we can move token generation to a shared place later.
    // For now, I will create a private helper here.

    private async generateTokensPayload(session: any, otherPayload: Partial<JWTTokenPayload> = {}): Promise<JWTTokenPayload> {
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
        const config = this.authConfigService.getConfig();
        if (config.session?.customizeTokenPayload) {
            payload = await config.session.customizeTokenPayload(payload, session);
        }
        return payload;
    }

    private async generateTokensFromSession(session: any): Promise<AuthTokensResponseDto> {
        const payload = await this.generateTokensPayload(session);
        return this.jwtService.generateTokens(payload);
    }

    // We also need generateAuthResponse helper...
    private async generateAuthResponse(
        user: NestAuthUser,
        session: any,
        tokens: { accessToken: string; refreshToken: string },
        isRequiresMfa: boolean
    ): Promise<AuthResponseDto> {
        let response: AuthResponseDto = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isRequiresMfa: isRequiresMfa,
        };

        if (isRequiresMfa) {
            const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
            response.mfaMethods = enabledMethods;
            response.defaultMfaMethod = this.mfaService.mfaConfig?.defaultMethod || enabledMethods[0];
        }

        const config = this.authConfigService.getConfig();
        if (config.auth?.transformResponse) {
            response = await config.auth.transformResponse(response, user, session);
        }
        return response;
    }

    async changePassword(input: NestAuthChangePasswordRequestDto): Promise<AuthResponseDto> {
        this.debugLogger.logFunctionEntry('changePassword', 'PasswordService');

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
                relations: ['roles'] // minimal relations needed
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

            // Re-hydrate user for session
            const session = await this.sessionManager.createSessionFromUser(user);
            const tokens = await this.generateTokensFromSession(session);
            const isRequiresMfa = await this.mfaService.isRequiresMfa(user.id);

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_CHANGED,
                new UserPasswordChangedEvent({
                    user,
                    initiatedBy: 'user'
                })
            );

            this.debugLogger.logFunctionExit('changePassword', 'PasswordService', { userId: user.id });
            return this.generateAuthResponse(user, session, tokens, isRequiresMfa);
        } catch (error) {
            this.debugLogger.logError(error, 'changePassword');
            this.handleError(error, 'password_change');
            throw error;
        }
    }

    async forgotPassword(input: NestAuthForgotPasswordRequestDto) {
        this.debugLogger.logFunctionEntry('forgotPassword', 'PasswordService', { email: input.email, phone: input.phone });

        try {
            const { email, phone } = input;
            let { tenantId = null } = input;

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
                const type = email ? 'Email' : 'Phone';
                throw new BadRequestException({
                    message: `${type} authentication is not enabled`,
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }

            const identity = await provider.findIdentity(email || phone);

            if (!identity) {
                return { message: 'If the account exists, a password reset code has been sent' };
            }

            const options = AuthConfigService.getOptions();
            let code: string;
            if (options.otp?.generate) {
                code = await options.otp.generate(this.mfaConfig.otpLength);
            } else {
                code = generateOtp(this.mfaConfig.otpLength);
            }

            let expiresAtMs: number;
            if (typeof this.mfaConfig.otpExpiresIn === 'string') {
                expiresAtMs = ms(this.mfaConfig.otpExpiresIn);
            } else {
                expiresAtMs = this.mfaConfig.otpExpiresIn || 900000;
            }

            if (!expiresAtMs || isNaN(expiresAtMs) || expiresAtMs <= 0) {
                expiresAtMs = 900000; // fallback
            }

            await this.otpRepository.delete({
                userId: identity.user?.id,
                type: NestAuthOTPTypeEnum.PASSWORD_RESET
            });

            const otpEntity = await this.otpRepository.create({
                userId: identity.user?.id,
                type: NestAuthOTPTypeEnum.PASSWORD_RESET,
                expiresAt: new Date(Date.now() + expiresAtMs),
                code,
            });
            await this.otpRepository.save(otpEntity);

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

            this.debugLogger.logFunctionExit('forgotPassword', 'PasswordService');
            return true;

        } catch (error) {
            this.debugLogger.logError(error, 'forgotPassword');
            this.handleError(error, 'password_reset');
            throw error;
        }
    }

    async verifyForgotPasswordOtp(input: NestAuthVerifyForgotPasswordOtpRequestDto): Promise<VerifyOtpResponseDto> {
        this.debugLogger.logFunctionEntry('verifyForgotPasswordOtp', 'PasswordService');
        try {
            const { email, phone, otp } = input;
            let { tenantId = null } = input;

            tenantId = await this.tenantService.resolveTenantId(tenantId);

            if (!email && !phone) {
                throw new BadRequestException({
                    message: 'Either email or phone must be provided',
                    code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
                });
            }

            let provider: BaseAuthProvider | null = null;
            if (phone) provider = this.authProviderRegistry.getProvider(PHONE_AUTH_PROVIDER);
            else if (email) provider = this.authProviderRegistry.getProvider(EMAIL_AUTH_PROVIDER);

            if (!provider) {
                throw new BadRequestException({
                    message: 'Phone or email authentication is not enabled',
                    code: ERROR_CODES.PROVIDER_NOT_FOUND,
                });
            }

            const identity = await provider.findIdentity((email || phone)!);

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
                    type: NestAuthOTPTypeEnum.PASSWORD_RESET,
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
            const passwordHashPrefix = user.passwordHash ? user.passwordHash.substring(0, 10) : '';
            const resetToken = await this.jwtService.generatePasswordResetToken({
                userId: user.id,
                passwordHashPrefix,
                type: 'password-reset'
            });

            await this.otpRepository.remove(validOtp);

            this.debugLogger.logFunctionExit('verifyForgotPasswordOtp', 'PasswordService');
            return {
                message: 'OTP verified successfully',
                resetToken
            };
        } catch (error) {
            this.debugLogger.logError(error, 'verifyForgotPasswordOtp');
            this.handleError(error, 'password_reset');
            throw error;
        }
    }

    async resetPasswordWithToken(input: NestAuthResetPasswordWithTokenRequestDto) {
        this.debugLogger.logFunctionEntry('resetPasswordWithToken', 'PasswordService', { token: '***' });

        try {
            const { token, newPassword } = input;

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

            const user = await this.userRepository.findOne({
                where: { id: decoded.userId }
            });

            if (!user) {
                throw new BadRequestException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

            const currentPasswordHashPrefix = user.passwordHash ? user.passwordHash.substring(0, 10) : '';
            if (decoded.passwordHashPrefix !== currentPasswordHashPrefix) {
                throw new BadRequestException({
                    message: 'Reset token is no longer valid',
                    code: ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
                });
            }

            await user.setPassword(newPassword);
            await this.userRepository.save(user);

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_RESET,
                new PasswordResetEvent({
                    user,
                    tenantId: user.tenantId,
                    input: { token, newPassword } as any,
                })
            );

            this.debugLogger.logFunctionExit('resetPasswordWithToken', 'PasswordService');
            return true;
        } catch (error) {
            this.debugLogger.logError(error, 'resetPasswordWithToken');
            this.handleError(error, 'password_reset');
            throw error;
        }
    }
}
