import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NestAuthOTP } from '../entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { IOtpOptions } from '../../core/interfaces/auth-module-options.interface';
import { generateOtp } from '../../utils/otp';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { ERROR_CODES } from '../../auth.constants';
import ms from 'ms';

export interface CreateOtpParams {
    userId: string;
    type: NestAuthOTPTypeEnum;
    /** Generation options; falls back to length 6, format numeric */
    otpOptions?: IOtpOptions | null;
    /** When true (default), deletes existing rows for the same userId + type before insert */
    replaceExisting?: boolean;
}

/**
 * Shared OTP lifecycle: invalidate previous codes, generate plain code, persist entity, hash via {@link NestAuthOTP.setCode}.
 */
@Injectable()
export class OtpFlowService {
    constructor(
        @InjectRepository(NestAuthOTP)
        private readonly otpRepository: Repository<NestAuthOTP>,
    ) {}

    get otpConfig(): IOtpOptions {
        return AuthConfigService.getOptions().otp;
    }

    /**
     * Converts config expiry (ms string, number ms, or undefined) to a positive millisecond duration.
     */
    resolveExpiresMs(raw: number | string | undefined, fallbackMsString: string): number {
        const fallback = ms(fallbackMsString) as number;
        if (raw === undefined || raw === null) {
            return fallback;
        }
        let n: number;
        if (typeof raw === 'string') {
            const parsed = ms(raw);
            n = typeof parsed === 'number' ? parsed : fallback;
        } else {
            n = raw;
        }
        if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
            return fallback;
        }
        return n;
    }

    /**
     * Produces the plaintext code sent to the user (before hashing).
     */
    async generatePlainCode(otpOptions?: IOtpOptions | null): Promise<string> {
        const length = otpOptions?.length ?? 6;
        const format = otpOptions?.format ?? 'numeric';
        if (otpOptions?.generate) {
            const out = otpOptions.generate(length, format);
            return out instanceof Promise ? out : Promise.resolve(out);
        }
        return generateOtp(length, format);
    }

    /**
     * Deletes existing OTP rows for the user and type (e.g. one active code per flow).
     */
    async deleteByUserAndType(userId: string, type: NestAuthOTPTypeEnum): Promise<void> {
        await this.otpRepository.delete({ userId, type });
    }

    /**
     * Full create: optional replace, save row with expiry, hash plaintext code.
     * Returns the entity (with hashed code on instance) and the plaintext for SMS/email events.
     */
    async createOtp(params: CreateOtpParams): Promise<{ entity: NestAuthOTP; plainCode: string }> {
        const { userId, type, otpOptions, replaceExisting = true } = params;

        if (replaceExisting) {
            await this.deleteByUserAndType(userId, type);
        }

        const expiresAtMs = this.resolveExpiresMs(this.otpConfig.codeExpiresIn, '10m');
        const expiresAt = new Date(Date.now() + expiresAtMs); 

        const entity = this.otpRepository.create({
            userId,
            type,
            expiresAt,
        });
        const plainCode = await this.generatePlainCode(otpOptions ?? undefined);
        await entity.setCode(plainCode);

        await this.otpRepository.save(entity);

        return { entity, plainCode };
    }

    /**
     * Validates a plaintext code against stored hashes for `userId` + `type`, enforces expiry,
     * then deletes the OTP row on success (same consume semantics as passwordless flows).
     *
     * @throws BadRequestException `VERIFICATION_CODE_INVALID` or `VERIFICATION_CODE_EXPIRED`
     */
    async validateAndConsume(params: {
        userId: string;
        type: NestAuthOTPTypeEnum;
        code: string;
    }): Promise<void> {
        const { userId, type, code } = params;
        const trimmed = code?.trim();
        if (!trimmed) {
            throw new BadRequestException({
                message: 'Verification code is required',
                code: ERROR_CODES.MISSING_REQUIRED_FIELD,
            });
        }

        const candidates = await this.otpRepository.find({
            where: { userId, type },
            order: { createdAt: 'DESC' },
        });

        for (const row of candidates) {
            const otp = await this.otpRepository.findOne({ where: { id: row.id } });
            if (!otp) {
                continue;
            }

            const expired = otp.expiresAt.getTime() <= Date.now();
            const matches = await otp.validateCode(trimmed);
            if (!matches) {
                continue;
            }
            if (expired) {
                throw new BadRequestException({
                    message: 'Verification code has expired',
                    code: ERROR_CODES.VERIFICATION_CODE_EXPIRED,
                });
            }
            await this.otpRepository.remove(otp);
            return;
        }

        // No code matched: this is a failed guess. Count it against the still-active
        // codes and invalidate them once the attempt cap is reached, so a short
        // numeric code can't be brute-forced within its TTL. Use an atomic
        // `increment` (not load-then-save) because `code` is `select: false` and
        // saving a partially-loaded entity would null it out — and so concurrent
        // verifies each count.
        const maxAttempts = this.otpConfig?.maxAttempts && this.otpConfig.maxAttempts > 0
            ? this.otpConfig.maxAttempts
            : 5;
        const now = Date.now();
        const activeIds = candidates.filter((o) => o.expiresAt.getTime() > now).map((o) => o.id);

        if (activeIds.length > 0) {
            await this.otpRepository.increment({ id: In(activeIds) }, 'attempts', 1);
            const refreshed = await this.otpRepository.find({ where: { id: In(activeIds) } });
            const exhaustedIds = refreshed.filter((o) => (o.attempts ?? 0) >= maxAttempts).map((o) => o.id);

            if (exhaustedIds.length > 0) {
                await this.otpRepository.delete({ id: In(exhaustedIds) });
            }

            // Every active code is now spent — tell the caller to request a new one.
            if (refreshed.length > 0 && refreshed.every((o) => (o.attempts ?? 0) >= maxAttempts)) {
                throw new BadRequestException({
                    message: 'Too many invalid attempts. Please request a new verification code.',
                    code: ERROR_CODES.VERIFICATION_CODE_INVALID,
                });
            }
        }

        throw new BadRequestException({
            message: 'Invalid verification code',
            code: ERROR_CODES.VERIFICATION_CODE_INVALID,
        });
    }
}
