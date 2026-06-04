import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { ERROR_CODES, NestAuthEvents } from '../../auth.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestContext } from '../../request-context/request-context';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { OtpFlowService } from './otp-flow.service';
import { NestAuthSendEmailVerificationRequestDto } from '../dto/requests/send-email-verification.request.dto';
import { NestAuthVerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto';
import { NestAuthSendPhoneVerificationRequestDto } from '../dto/requests/send-phone-verification.request.dto';
import { NestAuthVerifyPhoneRequestDto } from '../dto/requests/verify-phone.request.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { EmailVerificationRequestedEvent } from '../events/email-verification-requested.event';
import { PhoneVerificationRequestedEvent } from '../events/phone-verification-requested.event';

type VerificationErrorContext = 'signup';

@Injectable()
export class VerificationService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        private readonly eventEmitter: EventEmitter2,

        private readonly debugLogger: DebugLoggerService,

        private readonly authConfigService: AuthConfigService,

        private readonly otpFlow: OtpFlowService,
    ) { }

    private handleError(error: Error, context: VerificationErrorContext) {
        const config = this.authConfigService.getConfig();
        if (config.errorHandler) {
            const result = config.errorHandler(error, context);
            if (result) {
                throw result;
            }
        }
    }

    /**
     * Loads the current user or throws UNAUTHORIZED / USER_NOT_FOUND.
     */
    private async requireAuthenticatedUser(): Promise<NestAuthUser> {
        const userId = RequestContext.currentUserId();
        if (!userId) {
            throw new UnauthorizedException({
                message: 'User not authenticated',
                code: ERROR_CODES.UNAUTHORIZED,
            });
        }

        // NOTE: NestAuthUser has no `roles` relation (roles live on user_access);
        // requesting it here threw EntityPropertyNotFoundError → 500 on every
        // send-email/phone-verification call.
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException({
                message: 'User not found',
                code: ERROR_CODES.USER_NOT_FOUND,
            });
        }

        return user;
    }

    async sendEmailVerification(_input: NestAuthSendEmailVerificationRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('sendEmailVerification', 'VerificationService');

        try {
            const fullUser = await this.requireAuthenticatedUser();

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

            const { entity: otpEntity, plainCode: code } = await this.otpFlow.createOtp({
                userId: fullUser.id,
                type: NestAuthOTPTypeEnum.EMAIL_VERIFICATION,
                replaceExisting: true,
            });

            await this.eventEmitter.emitAsync(
                NestAuthEvents.EMAIL_VERIFICATION_REQUESTED,
                new EmailVerificationRequestedEvent({
                    user: fullUser,
                    tenantId: RequestContext.currentTenantId(),
                    otp: otpEntity,
                    code,
                }),
            );

            this.debugLogger.logFunctionExit('sendEmailVerification', 'VerificationService');
            return { message: 'Verification email sent successfully' };
        } catch (error) {
            this.debugLogger.logError(error, 'sendEmailVerification');
            this.handleError(error as Error, 'signup');
            throw error;
        }
    }

    async verifyEmail(input: NestAuthVerifyEmailRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('verifyEmail', 'VerificationService');

        try {
            const fullUser = await this.requireAuthenticatedUser();

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

            await this.otpFlow.validateAndConsume({
                userId: fullUser.id,
                type: NestAuthOTPTypeEnum.EMAIL_VERIFICATION,
                code: input.code,
            });

            fullUser.emailVerifiedAt = new Date();
            await this.userRepository.save(fullUser);

            await this.eventEmitter.emitAsync(NestAuthEvents.EMAIL_VERIFIED, {
                user: fullUser,
                tenantId: RequestContext.currentTenantId(),
            });

            this.debugLogger.logFunctionExit('verifyEmail', 'VerificationService');
            return { message: 'Email verified successfully' };
        } catch (error) {
            this.debugLogger.logError(error, 'verifyEmail');
            this.handleError(error as Error, 'signup');
            throw error;
        }
    }

    async sendPhoneVerification(_input: NestAuthSendPhoneVerificationRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('sendPhoneVerification', 'VerificationService');

        try {
            const fullUser = await this.requireAuthenticatedUser();

            if (!fullUser.phone) {
                throw new BadRequestException({
                    message: 'User does not have a phone number',
                    code: ERROR_CODES.NO_PHONE_NUMBER,
                });
            }

            if (fullUser.phoneVerifiedAt) {
                throw new BadRequestException({
                    message: 'Phone number is already verified',
                    code: ERROR_CODES.PHONE_ALREADY_VERIFIED,
                });
            }

            const { entity: otpEntity, plainCode: code } = await this.otpFlow.createOtp({
                userId: fullUser.id,
                type: NestAuthOTPTypeEnum.PHONE_VERIFICATION,
                replaceExisting: true,
            });

            await this.eventEmitter.emitAsync(
                NestAuthEvents.PHONE_VERIFICATION_REQUESTED,
                new PhoneVerificationRequestedEvent({
                    user: fullUser,
                    tenantId: RequestContext.currentTenantId(),
                    otp: otpEntity,
                    code,
                }),
            );

            this.debugLogger.logFunctionExit('sendPhoneVerification', 'VerificationService');
            return { message: 'Verification SMS sent successfully' };
        } catch (error) {
            this.debugLogger.logError(error, 'sendPhoneVerification');
            this.handleError(error as Error, 'signup');
            throw error;
        }
    }

    async verifyPhone(input: NestAuthVerifyPhoneRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('verifyPhone', 'VerificationService');

        try {
            const fullUser = await this.requireAuthenticatedUser();

            if (!fullUser.phone) {
                throw new BadRequestException({
                    message: 'User does not have a phone number',
                    code: ERROR_CODES.NO_PHONE_NUMBER,
                });
            }

            if (fullUser.phoneVerifiedAt) {
                throw new BadRequestException({
                    message: 'Phone number is already verified',
                    code: ERROR_CODES.PHONE_ALREADY_VERIFIED,
                });
            }

            await this.otpFlow.validateAndConsume({
                userId: fullUser.id,
                type: NestAuthOTPTypeEnum.PHONE_VERIFICATION,
                code: input.code,
            });

            fullUser.phoneVerifiedAt = new Date();
            await this.userRepository.save(fullUser);

            await this.eventEmitter.emitAsync(NestAuthEvents.PHONE_VERIFIED, {
                user: fullUser,
                tenantId: RequestContext.currentTenantId(),
            });

            this.debugLogger.logFunctionExit('verifyPhone', 'VerificationService');
            return { message: 'Phone verified successfully' };
        } catch (error) {
            this.debugLogger.logError(error, 'verifyPhone');
            this.handleError(error as Error, 'signup');
            throw error;
        }
    }
}
