import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { ERROR_CODES, NestAuthEvents } from '../../auth.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestContext } from '../../request-context/request-context';
import { generateOtp } from '../../utils/otp';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import moment from 'moment';
import { NestAuthSendEmailVerificationRequestDto } from '../dto/requests/send-email-verification.request.dto';
import { NestAuthVerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';

@Injectable()
export class VerificationService {

    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthOTP)
        private otpRepository: Repository<NestAuthOTP>,

        private readonly eventEmitter: EventEmitter2,

        private readonly debugLogger: DebugLoggerService,

        private readonly authConfigService: AuthConfigService,
    ) { }

    private handleError(error: Error, context: 'signup') {
        const config = this.authConfigService.getConfig();
        if (config.errorHandler) {
            const result = config.errorHandler(error, context);
            if (result) {
                throw result;
            }
        }
    }

    async sendEmailVerification(input: NestAuthSendEmailVerificationRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('sendEmailVerification', 'VerificationService');

        try {
            const user = RequestContext.currentUser();
            if (!user) {
                throw new UnauthorizedException({
                    message: 'User not authenticated',
                    code: ERROR_CODES.UNAUTHORIZED,
                });
            }

            const fullUser = await this.userRepository.findOne({
                where: { id: user.id },
                relations: ['roles']
            })

            if (!fullUser) {
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

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
                type: NestAuthOTPTypeEnum.VERIFICATION,
            });

            // Emit email verification event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.EMAIL_VERIFICATION_REQUESTED,
                {
                    user: fullUser,
                    tenantId: fullUser.tenantId,
                    otp: otpEntity,
                }
            );

            this.debugLogger.logFunctionExit('sendEmailVerification', 'VerificationService');
            return { message: 'Verification email sent successfully' };

        } catch (error) {
            this.debugLogger.logError(error, 'sendEmailVerification');
            this.handleError(error, 'signup');
            throw error;
        }
    }

    async verifyEmail(input: NestAuthVerifyEmailRequestDto): Promise<{ message: string }> {
        this.debugLogger.logFunctionEntry('verifyEmail', 'VerificationService');

        try {
            const user = RequestContext.currentUser();
            if (!user) {
                throw new UnauthorizedException({
                    message: 'User not authenticated',
                    code: ERROR_CODES.UNAUTHORIZED,
                });
            }

            const fullUser = await this.userRepository.findOne({
                where: { id: user.id },
                relations: ['roles']
            })

            if (!fullUser) {
                throw new UnauthorizedException({
                    message: 'User not found',
                    code: ERROR_CODES.USER_NOT_FOUND,
                });
            }

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
                    type: NestAuthOTPTypeEnum.VERIFICATION,
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

            this.debugLogger.logFunctionExit('verifyEmail', 'VerificationService');
            return { message: 'Email verified successfully' };

        } catch (error) {
            this.debugLogger.logError(error, 'verifyEmail');
            this.handleError(error, 'signup');
            throw error;
        }
    }
}
