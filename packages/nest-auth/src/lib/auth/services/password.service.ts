import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
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
import { NestAuthForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
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
import { BaseAuthProvider } from '../../core/providers/base-auth.provider';
import { OtpFlowService } from './otp-flow.service';
import type { MessageResponseDto } from 'src/lib/core';

@Injectable()
export class PasswordService {

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthOTP)
        private otpRepository: Repository<NestAuthOTP>,

        private readonly authProviderRegistry: AuthProviderRegistryService,

        private readonly sessionManager: SessionManagerService,

        private readonly jwtService: JwtService,

        private readonly eventEmitter: EventEmitter2,

        private readonly tenantService: TenantService,

        private readonly debugLogger: DebugLoggerService,

        private readonly authConfigService: AuthConfigService,

        private readonly otpFlow: OtpFlowService,
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


    async changePassword(input: NestAuthChangePasswordRequestDto): Promise<MessageResponseDto> {
        this.debugLogger.logFunctionEntry('changePassword', 'PasswordService');

        try {
            const currentUser = await RequestContext.currentUser();

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


            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_CHANGED,
                new UserPasswordChangedEvent({
                    user,
                    initiatedBy: 'user'
                })
            );

            return { message: 'Password changed successfully' };

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

            const { entity: otpEntity, plainCode } = await this.otpFlow.createOtp({
                userId: identity.user!.id,
                type: NestAuthOTPTypeEnum.PASSWORD_RESET,
                otpOptions: options.otp,
                replaceExisting: true,
            });

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PASSWORD_RESET_REQUESTED,
                new PasswordResetRequestedEvent({
                    user: identity.user,
                    tenantId,
                    input,
                    otp: otpEntity,
                    code: plainCode,
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
            const { email, phone, code, tenantId } = input;

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
                    code,
                    type: NestAuthOTPTypeEnum.PASSWORD_RESET,
                    used: false,
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
                tenantId: tenantId,
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
                    tenantId: RequestContext.currentTenantId(),
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
