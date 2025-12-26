/**
 * Verification Types
 * Email/phone verification and session types
 */

export interface IVerifyEmailRequest {
    otp: string;
}

export interface IResendVerificationRequest {
    email?: string;
}

export interface ISendEmailVerificationRequest {
    tenantId?: string;
}

export interface ISessionVerifyResponse {
    valid: boolean;
    userId?: string;
    expiresAt?: string;
}
