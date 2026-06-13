import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { OtpFlowService } from './otp-flow.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TwoFactorCodeSentEvent } from '../events/two-factor-code-sent.event';
import { NestAuthTrustedDevice } from '../entities/trusted-device.entity';
import { randomBytes } from 'crypto';
import { hmacSha256Hex, timingSafeEqualHex } from '../../utils/has-token';
import { IsNull, MoreThan } from 'typeorm';
import { User2faEnabledEvent } from '../events/user-2fa-enabled.event';
import { User2faDisabledEvent } from '../events/user-2fa-disabled.event';
import { RequestContext } from '../../request-context/request-context';
import ms from 'ms';


@Injectable()
export class MfaService {

    constructor(
        @InjectRepository(NestAuthMFASecret)
        private mfaSecretRepository: Repository<NestAuthMFASecret>,

        @InjectRepository(NestAuthUser)
        private userRepository: Repository<NestAuthUser>,

        @InjectRepository(NestAuthTrustedDevice)
        private trustedDeviceRepository: Repository<NestAuthTrustedDevice>,

        private eventEmitter: EventEmitter2,

        private readonly otpFlow: OtpFlowService,
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

        const user = await this.userRepository.findOne({ where: { id: userId } });

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
        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.EMAIL) && user?.email) {
            verifiedMethods.push(NestAuthMFAMethodEnum.EMAIL)
        }

        if (this.mfaConfig.methods?.includes(NestAuthMFAMethodEnum.SMS) && user?.phone) {
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

        const { plainCode } = await this.otpFlow.createOtp({
            userId,
            type: NestAuthOTPTypeEnum.MFA,
            replaceExisting: true,
        });

        if (method === NestAuthMFAMethodEnum.EMAIL || method === NestAuthMFAMethodEnum.SMS) {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user) {
                await this.eventEmitter.emitAsync(
                    NestAuthEvents.TWO_FACTOR_CODE_SENT,
                    new TwoFactorCodeSentEvent({
                        user,
                        tenantId: RequestContext.currentTenantId(),
                        method,
                        code: plainCode,
                    })
                );
            }
        }

        return true;
    }

    async verifyMfa(userId: string, inputOtp: string, method: NestAuthMFAMethodEnum): Promise<boolean> {

        this.requireMfaEnabledForApp(true)

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
            try {
                await this.otpFlow.validateAndConsume({
                    userId,
                    type: NestAuthOTPTypeEnum.MFA,
                    code: inputOtp,
                });

                // The user just proved they control the channel by entering a
                // code that was delivered there — that's exactly what email/
                // phone verification is. Stamp `*VerifiedAt` if it isn't set.
                await this.markChannelVerified(userId, method);

                return true;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * Lift `emailVerifiedAt` / `phoneVerifiedAt` after a successful
     * email-OTP / SMS-OTP MFA verification. Idempotent — only writes when
     * the field is currently null.
     */
    private async markChannelVerified(
        userId: string,
        method: NestAuthMFAMethodEnum,
    ): Promise<void> {
        try {
            if (method === NestAuthMFAMethodEnum.EMAIL) {
                await this.userRepository.update(
                    { id: userId, emailVerifiedAt: IsNull() },
                    { emailVerifiedAt: new Date() },
                );
            } else if (method === NestAuthMFAMethodEnum.SMS) {
                await this.userRepository.update(
                    { id: userId, phoneVerifiedAt: IsNull() },
                    { phoneVerifiedAt: new Date() },
                );
            }
        } catch {
            // Verification stamping is best-effort — don't fail MFA over it.
        }
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

        // Check if MFA is required - if so, users cannot disable it
        if (this.mfaConfig.required) {
            throw new ForbiddenException({
                message: 'MFA is required and cannot be disabled',
                code: ERROR_CODES.MFA_TOGGLING_NOT_ALLOWED,
            });
        }

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

    private getRecoveryCodeSecret(): string {
        const opts = AuthConfigService.getOptions();
        const secret = opts.mfa?.trustedDeviceSecret || opts.session?.jwt?.secret;
        if (!secret) {
            throw new Error('Recovery code HMAC secret is not configured. Set mfa.trustedDeviceSecret or session.jwt.secret.');
        }
        return secret;
    }

    async generateRecoveryCode(userId: string): Promise<string> {
        this.checkIsMfaEnabledForApp(true)

        // Generate a high-entropy recovery code and persist ONLY its HMAC hash.
        // The plaintext is returned once to the user and never stored.
        const plainCode = randomBytes(20).toString('base64url');
        const hashed = hmacSha256Hex(this.getRecoveryCodeSecret(), plainCode);
        await this.userRepository.update(userId, { mfaRecoveryCode: hashed });
        return plainCode;
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
        const stored = user.mfaRecoveryCode || '';
        const computed = hmacSha256Hex(this.getRecoveryCodeSecret(), code);
        if (stored && timingSafeEqualHex(stored, computed)) {
            // Consume the recovery code (single use)
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

    /**
     * Check if MFA is required for all users
     */
    isMfaRequired(): boolean {
        return this.mfaConfig.required ?? false;
    }

    /**
     * Check if users are allowed to toggle MFA
     * Returns true only if allowUserToggle is true AND MFA is not required
     */
    canUserToggleMfa(): boolean {
        const allowUserToggle = this.mfaConfig.allowUserToggle ?? false;
        const required = this.mfaConfig.required ?? false;
        return allowUserToggle && !required;
    }

    /**
     * Check if admin can disable MFA for a user
     * Returns false if MFA is required for all users
     */
    getMfaConfig(): MFAOptions {
        return this.mfaConfig
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

    private getTrustedDeviceSecret(): string {
        const secret = this.mfaConfig.trustedDeviceSecret;
        if (!secret) {
            throw new Error(
                'Trusted device HMAC secret is not configured. Set mfa.trustedDeviceSecret or session.jwt.secret.'
            );
        }
        return secret;
    }

    async createTrustedDevice(userId: string, userAgent: string, ipAddress: string): Promise<string> {
        this.requireMfaEnabledForApp(true);

        const plainToken = randomBytes(32).toString('base64url');
        const duration = this.mfaConfig.trustedDeviceDuration;
        const expiresAtMs = ms(duration);

        const secret = this.getTrustedDeviceSecret();
        const device = this.trustedDeviceRepository.create({
            userId,
            userAgent,
            ipAddress,
            expiresAt: new Date(Date.now() + expiresAtMs),
            // revokedAt is left unset → stored as NULL (nullable column).
        });
        await device.setTrustToken(secret, plainToken);
        await this.trustedDeviceRepository.save(device);

        return plainToken;
    }

    /**
     * Validates the presented bearer token by verifying against active trusted devices.
     * Enforces expiry/revocation, touches lastUsedAt on success.
     */
    async validateTrustedDevice(userId: string, token: string): Promise<boolean> {
        if (!token) {
            return false;
        }

        const secret = this.getTrustedDeviceSecret();
        const candidates = await this.trustedDeviceRepository.find({
            where: {
                userId,
                revokedAt: IsNull(),
                expiresAt: MoreThan(new Date()),
            },
            select: ['id', 'tokenHash'],
        });

        const now = new Date();
        for (const device of candidates) {
            if (!(await device.validateTrustToken(secret, token))) {
                continue;
            }
            device.lastUsedAt = now;
            await this.trustedDeviceRepository.save(device);
            return true;
        }

        return false;
    }
}
