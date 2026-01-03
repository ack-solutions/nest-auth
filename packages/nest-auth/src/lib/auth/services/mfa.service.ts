import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { NestAuthMFASecret } from '../../auth/entities/mfa-secret.entity';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { MFAOptions } from '../../core/interfaces/mfa-options.interface';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import {
    ERROR_CODES,
    NestAuthEvents,
} from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../../auth/entities/otp.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { generateOtp } from '../../utils/otp';
import ms from 'ms';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TwoFactorCodeSentEvent } from '../events/two-factor-code-sent.event';
import { NestAuthTrustedDevice } from '../entities/trusted-device.entity';
import { randomBytes } from 'crypto';
import { User2faEnabledEvent } from '../events/user-2fa-enabled.event';
import { User2faDisabledEvent } from '../events/user-2fa-disabled.event';


@Injectable()
export class MfaService {

    constructor(
        @InjectRepository(NestAuthMFASecret)
        private mfaSecretRepository: Repository<NestAuthMFASecret>,

        @InjectRepository(NestAuthUser)
        private userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthOTP)
        private otpRepository: Repository<NestAuthOTP>,

        @InjectRepository(NestAuthTrustedDevice)
        private trustedDeviceRepository: Repository<NestAuthTrustedDevice>,

        private eventEmitter: EventEmitter2,
    ) { }

    get mfaConfig(): MFAOptions {
        return AuthConfigService.getOptions().mfa || {};
    }

    requireMfaEnabledForApp(throwError: boolean = true) {
        if (!this.mfaConfig.enabled) {
            if (throwError) {
                throw new ForbiddenException({
                    message: 'MFA is not enabled for the application',
                    code: ERROR_CODES.MFA_NOT_ENABLED,
                });
            }
            return false;
        }
        return true;
    }

    private checkIsMfaEnabledForApp(throwError: boolean = true) {
        return this.requireMfaEnabledForApp(throwError);
    }

    async getVerifiedMethods(userId: string): Promise<NestAuthMFAMethodEnum[]> {
        if (!this.requireMfaEnabledForApp(false)) {
            return [];
        }

        const verifiedMethods: NestAuthMFAMethodEnum[] = []

        // Check for verified TOTP devices
        const verifiedTotpDevice = await this.mfaSecretRepository.findOne({
            where: {
                userId,
                verified: true,
            },
        });

        if (verifiedTotpDevice && this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.TOTP)) {
            verifiedMethods.push(NestAuthMFAMethodEnum.TOTP)
        }

        // Note: EMAIL and SMS methods are always available if configured
        // They don't require pre-verification like TOTP does
        // But we only include them if they're in the config
        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.EMAIL)) {
            verifiedMethods.push(NestAuthMFAMethodEnum.EMAIL)
        }

        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.SMS)) {
            verifiedMethods.push(NestAuthMFAMethodEnum.SMS)
        }

        return verifiedMethods;
    }

    async getEnabledMethods(userId: string): Promise<NestAuthMFAMethodEnum[]> {
        if (!this.requireMfaEnabledForApp(false)) {
            return [];
        }

        const isEnabled = await this.isMfaEnabled(userId)
        if (!isEnabled) {
            return [];
        }

        const enableMethod: NestAuthMFAMethodEnum[] = [];

        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.EMAIL)) {
            enableMethod.push(NestAuthMFAMethodEnum.EMAIL)
        }

        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.SMS)) {
            enableMethod.push(NestAuthMFAMethodEnum.SMS)
        }

        const verifiedTotpDevice = await this.mfaSecretRepository.findOne({
            where: {
                userId,
                verified: true,
            },
        });

        if (verifiedTotpDevice) {
            enableMethod.push(NestAuthMFAMethodEnum.TOTP)
        }

        return enableMethod;
    }


    async sendMfaCode(userId: string, method: NestAuthMFAMethodEnum): Promise<boolean> {

        this.requireMfaEnabledForApp(true)

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
            userId,
            type: NestAuthOTPTypeEnum.MFA
        });

        const otp = await this.otpRepository.create({
            userId,
            type: NestAuthOTPTypeEnum.MFA,
            expiresAt: new Date(Date.now() + expiresAtMs),
            code,
        })
        await this.otpRepository.save(otp);

        if (method === NestAuthMFAMethodEnum.EMAIL || method === NestAuthMFAMethodEnum.SMS) {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user) {
                await this.eventEmitter.emitAsync(
                    NestAuthEvents.TWO_FACTOR_CODE_SENT,
                    new TwoFactorCodeSentEvent({
                        user,
                        tenantId: user.tenantId,
                        method,
                        code,
                    })
                );
            }
        }

        return true;
    }

    async verifyMfa(userId: string, inputOtp: string, method: NestAuthMFAMethodEnum): Promise<boolean> {

        this.requireMfaEnabledForApp(true)

        // Check for default OTP (Magic Code)
        if (this.mfaConfig.defaultOtp && this.mfaConfig.defaultOtp === inputOtp) {
            return true;
        }

        if (method === NestAuthMFAMethodEnum.TOTP) {
            const devices = await this.mfaSecretRepository.find({
                where: { userId, verified: true }
            });

            for (const device of devices) {
                const isValid = speakeasy.totp.verify({
                    secret: device.secret,
                    encoding: 'base32',
                    token: inputOtp,
                    window: 1
                });

                if (isValid) {
                    // Update last used timestamp
                    await this.mfaSecretRepository.update(
                        { id: device.id },
                        { lastUsedAt: new Date() }
                    );
                    return true;
                }
            }
            return false;
        }

        if (method === NestAuthMFAMethodEnum.EMAIL || method === NestAuthMFAMethodEnum.SMS) {
            const otp = await this.otpRepository.findOne({
                where: {
                    userId,
                    type: NestAuthOTPTypeEnum.MFA,
                    used: false,
                    expiresAt: MoreThan(new Date()),
                    code: inputOtp
                }
            });

            if (!otp) {
                return false;
            }
            await this.otpRepository.delete(otp.id);
            return true;
        }

        return false;
    }


    async setupTotpDevice(userId: string, deviceName?: string): Promise<{ secret: string; qrCode: string }> {
        this.requireMfaEnabledForApp(true)

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        const secret = speakeasy.generateSecret();

        await this.mfaSecretRepository.save({
            userId,
            secret: secret.base32,
            deviceName: deviceName || 'Authenticator',
            verified: false
        });

        const qrCode = await qrcode.toDataURL(secret.otpauth_url || '');
        return { secret: secret.base32, qrCode };
    }

    async verifyTotpSetup(userId: string, secret: string, inputOtp: string): Promise<boolean> {

        this.requireMfaEnabledForApp(true)

        const device = await this.mfaSecretRepository.findOne({
            where: { userId, secret }
        });

        if (device) {
            if (device.verified) {
                return true;
            }

            const isValid = speakeasy.totp.verify({
                secret: device.secret,
                encoding: 'base32',
                token: inputOtp,
                window: 1
            });

            if (isValid) {
                await this.mfaSecretRepository.update({ id: device.id }, { verified: true });
                return true;
            }
        }

        return false;
    }

    async getTotpDevices(userId: string) {
        this.requireMfaEnabledForApp(true)

        const devices = await this.mfaSecretRepository.find({
            select: ['id', 'deviceName', 'lastUsedAt', 'verified', 'createdAt'],
            where: { userId },
            order: { lastUsedAt: 'DESC', createdAt: 'DESC' }
        });

        return devices.map(device => ({
            id: device.id,
            deviceName: device.deviceName,
            method: NestAuthMFAMethodEnum.TOTP,
            lastUsedAt: device.lastUsedAt,
            createdAt: device.createdAt,
            verified: device.verified,
        }));
    }

    async removeDevice(deviceId: string): Promise<void> {
        this.requireMfaEnabledForApp(true)

        await this.mfaSecretRepository.delete({ id: deviceId });
    }

    async isRequiresMfa(userId: string): Promise<boolean> {
        if (!this.mfaConfig.enabled) {
            return false;
        }

        if (this.mfaConfig.required) {
            return true;
        }

        const user = await this.userRepository.findOne({
            select: ['id', 'isMfaEnabled'],
            where: { id: userId },
        });
        return !!user?.isMfaEnabled;
    }

    async isMfaEnabled(userId: string): Promise<boolean> {
        if (this.mfaConfig.enabled) {
            const user = await this.userRepository.findOne({
                select: ['id', 'isMfaEnabled'],
                where: { id: userId },
            });
            return !!user?.isMfaEnabled;
        }
        return false;
    }

    async markAsVerified(userId: string, deviceId: string): Promise<void> {
        this.requireMfaEnabledForApp(true)
        await this.mfaSecretRepository.update(
            { id: deviceId, userId },
            { verified: true }
        );
    }

    async enableMFA(userId: string) {
        this.requireMfaEnabledForApp(true)

        if (!this.mfaConfig.allowUserToggle) {
            throw new ForbiddenException({
                message: 'MFA toggling is not allowed',
                code: ERROR_CODES.MFA_TOGGLING_NOT_ALLOWED,
            });
        }

        const verifiedMethods = await this.getVerifiedMethods(userId);
        if (verifiedMethods.length === 0) {
            throw new ForbiddenException({
                message: 'Cannot enable MFA without at least one verified method',
                code: ERROR_CODES.MFA_CANNOT_ENABLE_WITHOUT_METHOD,
            });
        }

        await this.userRepository.update(userId, { isMfaEnabled: true });

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_ENABLED,
                new User2faEnabledEvent({
                    user,
                    method: verifiedMethods[0] // Default to first verified method
                })
            );
        }
    }

    async disableMFA(userId: string) {
        this.checkIsMfaEnabledForApp(true);

        if (!this.mfaConfig.allowUserToggle) {
            throw new ForbiddenException({
                message: 'MFA toggling is not allowed',
                code: ERROR_CODES.MFA_TOGGLING_NOT_ALLOWED,
            });
        }
        await this.userRepository.update(userId, { isMfaEnabled: false });

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_DISABLED,
                new User2faDisabledEvent({
                    user
                })
            );
        }
    }

    async removeTotpDevice(deviceId: string): Promise<void> {
        this.checkIsMfaEnabledForApp(true)

        await this.mfaSecretRepository.delete({ id: deviceId });
    }

    async generateRecoveryCode(userId: string): Promise<string> {
        this.checkIsMfaEnabledForApp(true)

        const secret = speakeasy.generateSecret({
            name: `NestAuth:${userId}`,
        });
        await this.userRepository.update(userId, { mfaRecoveryCode: secret.base32 });
        return secret.base32;
    }

    async resetMfa(userId: string, code: string): Promise<{ message: string }> {

        this.checkIsMfaEnabledForApp(true)

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException({
                message: 'User not found',
                code: ERROR_CODES.USER_NOT_FOUND
            });
        }
        if (user.mfaRecoveryCode === code) {
            // Delete recovery code
            await this.userRepository.update(userId, { mfaRecoveryCode: null });

            // Delete all mfa secrets
            await this.mfaSecretRepository.delete({ userId });

            return {
                message: 'Recovery code verified',
            };
        }

        throw new UnauthorizedException({
            message: 'Invalid recovery code',
            code: ERROR_CODES.MFA_RECOVERY_CODE_INVALID
        });
    }

    getAvailableMethods(): NestAuthMFAMethodEnum[] {
        if (!this.requireMfaEnabledForApp(false)) {
            return [];
        }
        // Deduplicate methods to ensure unique values
        const methods = this.mfaConfig.methods ?? [];
        return [...new Set(methods)];
    }

    async hasRecoveryCode(userId: string): Promise<boolean> {
        if (!this.checkIsMfaEnabledForApp(false)) {
            return false;
        }

        const user = await this.userRepository.findOne({
            select: ['id', 'mfaRecoveryCode'],
            where: { id: userId },
        });

        return Boolean(user?.mfaRecoveryCode);
    }

    async createTrustedDevice(userId: string, userAgent: string, ipAddress: string): Promise<string> {
        this.requireMfaEnabledForApp(true);

        const token = randomBytes(32).toString('hex');
        const duration = this.mfaConfig.trustedDeviceDuration || '30d';
        const expiresAtMs = typeof duration === 'string' ? ms(duration) : duration;

        await this.trustedDeviceRepository.save({
            userId,
            token,
            userAgent,
            ipAddress,
            expiresAt: new Date(Date.now() + expiresAtMs),
        });

        return token;
    }

    async validateTrustedDevice(userId: string, token: string): Promise<boolean> {
        if (!token) return false;

        const device = await this.trustedDeviceRepository.findOne({
            where: { userId, token },
        });

        if (!device) return false;

        if (device.expiresAt < new Date()) {
            await this.trustedDeviceRepository.remove(device);
            return false;
        }

        await this.trustedDeviceRepository.update(device.id, { lastUsedAt: new Date() });
        return true;
    }
}
