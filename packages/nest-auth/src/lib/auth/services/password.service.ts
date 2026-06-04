import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
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
import { NestAuthVerifyForgotPasswordOtpRequestDto } from '../dto/requests/verify-forgot-password-otp-request-dto';
import { NestAuthResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';
import { NestAuthChangePasswordRequestDto } from '../dto/requests/change-password.request.dto';
import { VerifyOtpResponseDto } from '../dto/responses/verify-otp.response.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { BaseAuthProvider } from '../../core/providers/base-auth.provider';
import { OtpFlowService } from './otp-flow.service';
import type { MessageResponseDto } from '../../core/dto/message.response.dto';
import { hmacSha256Hex, timingSafeEqualHex } from '../../utils/has-token';

@Injectable()
export class PasswordService {

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

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

    /**
     * Single-use signature for a password-reset token: HMAC over the FULL current
     * password hash. Because the hash changes when the password is reset, any
     * previously-issued reset token (which carries the old signature) is
     * automatically invalidated — making the token effectively single-use.
     */
    private resetSignature(passwordHash: string): string {
        const secret = AuthConfigService.getOptions().session?.jwt?.secret;
        if (!secret) {
            throw new Error('Missing session.jwt.secret');
        }
        return hmacSha256Hex(secret, passwordHash || '');
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

            // Note: 'roles' is NOT a relation on NestAuthUser (access is via
            // userAccesses) — requesting it threw "Relation not found" → 500.
            // We also must explicitly select `passwordHash` (select: false) so
            // validatePassword can verify the current password without relying
            // on the brittle BaseEntity.createQueryBuilder fallback.
            const user = await this.userRepository.findOne({
                where: { id: currentUser.id },
                select: { id: true, email: true, phone: true, passwordHash: true },
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
            // Return the SAME generic message as the "account not found" branch
            // above so the response shape can't be used to enumerate accounts.
            return { message: 'If the account exists, a password reset code has been sent' };

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

            const userId = identity.user?.id;
            if (!userId) {
                throw new BadRequestException({
                    message: 'Invalid reset request',
                    code: ERROR_CODES.PASSWORD_RESET_INVALID_REQUEST,
                });
            }

            await this.otpFlow.validateAndConsume({
                userId,
                type: NestAuthOTPTypeEnum.PASSWORD_RESET,
                code,
            });

            const user = await this.userRepository.findOne({ where: { id: userId }, select: { id: true, passwordHash: true } });
            if (!user) {
                throw new BadRequestException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }
            // Sign over the FULL password hash (select:false → fetched explicitly).
            const passwordHashPrefix = user.passwordHash ? this.resetSignature(user.passwordHash) : '';
            const resetToken = await this.jwtService.generatePasswordResetToken({
                userId: user.id,
                passwordHashPrefix,
                tenantId: tenantId,
                type: 'password-reset'
            });

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

            // passwordHash is select:false — fetch it explicitly to verify the
            // single-use signature embedded in the reset token.
            const withHash = await this.userRepository.findOne({
                where: { id: decoded.userId },
                select: { id: true, passwordHash: true },
            });
            const currentSignature = withHash?.passwordHash ? this.resetSignature(withHash.passwordHash) : '';
            if (!timingSafeEqualHex(String(decoded.passwordHashPrefix || ''), currentSignature)) {
                throw new BadRequestException({
                    message: 'Reset token is no longer valid',
                    code: ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
                });
            }

            await user.setPassword(newPassword);
            await this.userRepository.save(user);

            // Invalidate all existing sessions after a password reset — account
            // recovery must log out any attacker holding a live session.
            await this.sessionManager.revokeAllUserSessions(user.id);

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
