/**
 * MFA Types
 * Multi-factor authentication related types
 */

import { NestAuthMFAMethodEnum } from './auth';

// --- Entity Interfaces ---

export interface INestAuthMFASecret {
    id: string;
    userId: string;
    secret: string;
    verified: boolean;
    deviceName?: string;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthTrustedDevice {
    id: string;
    userId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
    revokedAt?: Date | null;
    lastUsedAt?: Date;
    createdAt: Date;
}

// --- Request/Response Interfaces ---

export interface IVerify2faRequest {
    otp: string;
    method?: NestAuthMFAMethodEnum;
    trustDevice?: boolean;
}

export interface IVerify2faResponse {
    accessToken: string;
    refreshToken: string;
    message?: string;
    trustToken?: string;
}

/**
 * Redeem a single-use MFA recovery (backup) code to COMPLETE a sign-in. Unlike
 * `reset-totp` (which deletes factors), this leaves MFA enabled and the enrolled
 * factors intact — the recovery code acts as a backup authenticator.
 */
export interface IVerifyRecoveryCodeRequest {
    code: string;
    trustDevice?: boolean;
}

/** Response of `POST /auth/mfa/generate-recovery-code`. */
export interface IGenerateRecoveryCodesResponse {
    /** The fresh set of single-use recovery codes (shown ONCE). */
    codes: string[];
    /** @deprecated First of `codes`, kept for backward compatibility. */
    code: string;
}

export interface ISendMfaCodeRequest {
    method: NestAuthMFAMethodEnum;
}

export interface IToggleMfaRequest {
    enabled: boolean;
}

export interface IVerifyTotpSetupRequest {
    otp: string;
    secret: string;
}

export interface IMfaDevice {
    id: string;
    deviceName: string;
    method: NestAuthMFAMethodEnum;
    lastUsedAt?: Date | string | null;
    verified: boolean;
    createdAt?: Date | string | null;
}

export interface IMfaStatusResponse {
    isEnabled: boolean;
    verifiedMethods: NestAuthMFAMethodEnum[];
    configuredMethods: NestAuthMFAMethodEnum[];
    allowUserToggle: boolean;
    allowMethodSelection: boolean;
    totpDevices: IMfaDevice[];
    hasRecoveryCode: boolean;
    /** Whether MFA is required for all users (cannot be disabled) */
    required?: boolean;
    /** Whether the user can toggle MFA (accounts for both allowUserToggle and required) */
    canToggle?: boolean;
}

export interface IMfaCodeResponse {
    code: string;
    expiresAt: Date | string;
    used: boolean;
    warning?: string;
}

export interface ITotpSetupResponse {
    secret: string;
    qrCode: string;
    /** The raw `otpauth://` URI encoded in the QR (issuer + account label + period). */
    otpAuthUrl: string;
    /** Issuer shown in the authenticator (from `mfa.totp.issuer`, else `appName`). */
    issuer?: string;
    /** Account label shown under the issuer (defaults to the user's email; overridable). */
    account?: string;
}

/** Optional body for `POST /auth/mfa/setup-totp`. */
export interface ISetupTotpRequest {
    /** Account label shown in the authenticator (defaults to the user's email). */
    label?: string;
    /** Stored device name (not shown in the app). */
    deviceName?: string;
}
