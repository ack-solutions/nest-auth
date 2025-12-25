/**
 * MFA Types
 * Multi-factor authentication related types
 */

import { MFAMethodEnum } from './auth';

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
    token: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
    lastUsedAt?: Date;
    createdAt: Date;
}

// --- Request/Response Interfaces ---

export interface IVerify2faRequest {
    otp: string;
    method?: MFAMethodEnum;
    trustDevice?: boolean;
}

export interface IVerify2faResponse {
    accessToken: string;
    refreshToken: string;
    message?: string;
    trustToken?: string;
}

export interface ISendMfaCodeRequest {
    method: MFAMethodEnum;
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
    method: MFAMethodEnum;
    lastUsedAt?: Date | string | null;
    verified: boolean;
    createdAt?: Date | string | null;
}

export interface IMfaStatusResponse {
    isEnabled: boolean;
    verifiedMethods: MFAMethodEnum[];
    configuredMethods: MFAMethodEnum[];
    allowUserToggle: boolean;
    allowMethodSelection: boolean;
    totpDevices: IMfaDevice[];
    hasRecoveryCode: boolean;
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
    otpAuthUrl: string;
}
