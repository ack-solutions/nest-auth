import { ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthMFASecret } from '../../auth/entities/mfa-secret.entity';
import { NestAuthMfaRecoveryCode } from '../../auth/entities/mfa-recovery-code.entity';
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

        @InjectRepository(NestAuthMfaRecoveryCode)
        private mfaRecoveryCodeRepository: Repository<NestAuthMfaRecoveryCode>,

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
            } catch (err) {
                // Surface the specific OTP reason to the client — expired, invalid,
                // or "too many attempts, request a new code" once the cap deletes
                // the code — instead of collapsing every failure to a generic MFA
                // error. This gives MFA the same reporting the password-reset OTP
                // flow already has. Fail closed on any non-coded error.
                if (err instanceof HttpException) throw err;
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


    /**
     * Begin TOTP enrolment: generate a secret + a QR code the user scans with an
     * authenticator app.
     *
     * The scanned `otpauth://` URI controls what the authenticator DISPLAYS:
     *   - **issuer** — the app/service name (from `mfa.totp.issuer`, falling back to
     *     `appName`). Shown as the bold heading in the app.
     *   - **account label** — who the entry is for. Defaults to the user's email
     *     (then phone, then id). Pass `label` to override — handy for multi-tenant
     *     apps where one person has several accounts under the same issuer, e.g.
     *     `label: `${user.email} (${tenantName})``, so the entries are
     *     distinguishable instead of all showing the same name.
     *
     * (Previously this called `speakeasy.generateSecret()` with no options, so the
     * URI carried speakeasy's default label `"SecretKey"` and no issuer — which is
     * why authenticators showed "SecretKey".)
     */
    async setupTotpDevice(
        userId: string,
        deviceName?: string,
        label?: string,
    ): Promise<{ secret: string; qrCode: string; otpAuthUrl: string; issuer: string; account: string }> {
        this.requireMfaEnabledForApp(true)

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        // Opt-in (mfa.requireVerifiedContactForEnrollment): only allow enrolling a
        // new authenticator when the user has a verified email or phone, so an
        // abandoned enrolment can't strand the account with no recoverable factor.
        if (this.mfaConfig.requireVerifiedContactForEnrollment && !user.emailVerifiedAt && !user.phoneVerifiedAt) {
            throw new ForbiddenException({
                message: 'A verified email or phone is required before enrolling an authenticator',
                code: ERROR_CODES.MFA_CANNOT_ENABLE_WITHOUT_METHOD,
            });
        }

        const opts = AuthConfigService.getOptions();
        const issuer = opts.mfa?.totp?.issuer || opts.appName || 'App';
        const period = opts.mfa?.totp?.period || 30;
        // Account label the authenticator shows for this entry.
        const account = (label && label.trim()) || user.email || user.phone || userId;

        const secret = speakeasy.generateSecret({ length: 20 });
        const otpAuthUrl = speakeasy.otpauthURL({
            secret: secret.base32,
            encoding: 'base32',
            label: account,
            issuer,
            period,
        });

        await this.mfaSecretRepository.save({
            userId,
            secret: secret.base32,
            deviceName: deviceName || account,
            verified: false
        });

        const qrCode = await qrcode.toDataURL(otpAuthUrl);
        return { secret: secret.base32, qrCode, otpAuthUrl, issuer, account };
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

    async removeTotpDevice(deviceId: string, userId: string): Promise<void> {
        this.checkIsMfaEnabledForApp(true)

        // Scope the delete to the OWNER. Without the userId filter any authenticated
        // user could delete another user's TOTP device (IDOR) and downgrade them to
        // a single factor. A non-owned / unknown id returns 404 (no cross-user probe).
        const result = await this.mfaSecretRepository.delete({ id: deviceId, userId });
        if (!result.affected) {
            throw new NotFoundException('MFA device not found');
        }
    }

    private getRecoveryCodeSecret(): string {
        const opts = AuthConfigService.getOptions();
        const secret = opts.mfa?.trustedDeviceSecret || opts.session?.jwt?.secret;
        if (!secret) {
            throw new Error('Recovery code HMAC secret is not configured. Set mfa.trustedDeviceSecret or session.jwt.secret.');
        }
        return secret;
    }

    /**
     * Generate a fresh SET of recovery (backup) codes. Regenerating replaces any
     * outstanding unused codes (used codes are kept for audit). Only the HMAC hash
     * of each code is stored — the plaintext set is returned ONCE and can never be
     * retrieved again. Count is `mfa.recoveryCodeCount` (default 10).
     */
    async generateRecoveryCodes(userId: string): Promise<string[]> {
        this.checkIsMfaEnabledForApp(true);

        const count = this.mfaConfig.recoveryCodeCount && this.mfaConfig.recoveryCodeCount > 0
            ? this.mfaConfig.recoveryCodeCount
            : 10;
        const secret = this.getRecoveryCodeSecret();

        // Replace the outstanding set: drop unused codes and clear the legacy
        // single-column code so neither can be redeemed after regeneration.
        await this.mfaRecoveryCodeRepository.delete({ userId, usedAt: IsNull() });
        await this.userRepository.update(userId, { mfaRecoveryCode: null });

        const plainCodes: string[] = [];
        const rows: NestAuthMfaRecoveryCode[] = [];
        for (let i = 0; i < count; i++) {
            const plain = randomBytes(20).toString('base64url');
            plainCodes.push(plain);
            rows.push(this.mfaRecoveryCodeRepository.create({
                userId,
                codeHash: hmacSha256Hex(secret, plain),
            }));
        }
        await this.mfaRecoveryCodeRepository.save(rows);
        return plainCodes;
    }

    /**
     * Backward-compatible alias returning a single code (the first of a fresh set).
     * @deprecated use {@link generateRecoveryCodes}.
     */
    async generateRecoveryCode(userId: string): Promise<string> {
        const codes = await this.generateRecoveryCodes(userId);
        return codes[0];
    }

    /**
     * Verify a recovery code and CONSUME it (single-use). Checks the multi-code
     * table first, then the legacy single-column code (pre-2.10.0 accounts).
     * Constant-time compare. Returns true iff a valid, unused code matched.
     */
    async verifyAndConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
        if (!code) return false;
        const hash = hmacSha256Hex(this.getRecoveryCodeSecret(), code);

        const rows = await this.mfaRecoveryCodeRepository.find({ where: { userId, usedAt: IsNull() } });
        for (const row of rows) {
            if (timingSafeEqualHex(row.codeHash, hash)) {
                await this.mfaRecoveryCodeRepository.update({ id: row.id }, { usedAt: new Date() });
                return true;
            }
        }

        // Legacy single-column code.
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const legacy = user?.mfaRecoveryCode || '';
        if (legacy && timingSafeEqualHex(legacy, hash)) {
            await this.userRepository.update(userId, { mfaRecoveryCode: null });
            return true;
        }
        return false;
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
        // Verify + consume the recovery code (multi-code table, with legacy
        // single-column fallback).
        const ok = await this.verifyAndConsumeRecoveryCode(userId, code);
        if (!ok) {
            throw new UnauthorizedException({
                message: 'Invalid recovery code',
                code: ERROR_CODES.MFA_RECOVERY_CODE_INVALID
            });
        }

        // Delete all mfa secrets
        await this.mfaSecretRepository.delete({ userId });

        // A recovery reset deletes every TOTP factor. If no verified method
        // remains, MFA would be left "on with zero methods" — the invalid
        // state enableMFA itself refuses to create, and one that PERMANENTLY
        // LOCKS OUT a TOTP-only user: the next login returns requiresMfa with
        // an empty method list AND the recovery code is already spent. Turn
        // MFA off so the user can sign in and re-enrol. (If a verified
        // email/SMS method survives, MFA stays on — they aren't locked out.)
        const remaining = await this.getVerifiedMethods(userId);
        if (remaining.length === 0) {
            await this.userRepository.update(userId, { isMfaEnabled: false });
            // Notify the account owner that 2FA is now off (parity with disableMFA).
            await this.eventEmitter.emitAsync(
                NestAuthEvents.TWO_FACTOR_DISABLED,
                new User2faDisabledEvent({ user }),
            );
        }

        return {
            message: 'Recovery code verified',
        };
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

        // An UNUSED code in the multi-code table, or the legacy single column.
        const unused = await this.mfaRecoveryCodeRepository.count({ where: { userId, usedAt: IsNull() } });
        if (unused > 0) return true;

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
