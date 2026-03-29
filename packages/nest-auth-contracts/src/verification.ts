/**
 * Verification Types
 * Email/phone verification and session types
 */

export interface IVerifyEmailRequest {
    /** Verification code (entity field `code`; may be OTP or magic-link code). */
    code: string;
}

export interface IResendVerificationRequest {
    email?: string;
}

export interface ISendEmailVerificationRequest {
    tenantId?: string;
}

export interface IVerifyPhoneRequest {
    /** Verification code sent via SMS (stored hashed on the OTP entity). */
    code: string;
    tenantId?: string;
}

export interface ISendPhoneVerificationRequest {
    tenantId?: string;
}

export interface ISessionVerifyResponse {
    valid: boolean;
    userId?: string;
    expiresAt?: string;
}
