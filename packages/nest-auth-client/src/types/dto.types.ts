/**
 * Request and Response DTOs for authentication operations
 */

import { AuthUser, TokenPair } from './auth.types';

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Email-based login credentials
 */
export interface EmailCredentials {
    email: string;
    password: string;
}

/**
 * Phone-based login credentials
 */
export interface PhoneCredentials {
    phone: string;
    password: string;
}

/**
 * Social login credentials (OAuth token)
 */
export interface SocialCredentials {
    token: string;
}

/**
 * Login credentials union type
 */
export type LoginCredentials = EmailCredentials | PhoneCredentials | SocialCredentials | Record<string, any>;

/**
 * Login request DTO
 */
export interface LoginDto {
    /** Authentication provider name */
    providerName?: 'email' | 'phone' | 'google' | 'facebook' | 'apple' | 'github' | string;
    /** Login credentials */
    credentials: LoginCredentials;
    /** Tenant ID for multi-tenant applications */
    tenantId?: string;
    /** Auto-create user if not exists (for social auth) */
    createUserIfNotExists?: boolean;
}

/**
 * Signup request DTO
 */
export interface SignupDto {
    /** User email address (required if phone not provided) */
    email?: string;
    /** User phone number (required if email not provided) */
    phone?: string;
    /** User password */
    password: string;
    /** Tenant ID for multi-tenant applications */
    tenantId?: string;
    /** Additional user data */
    [key: string]: any;
}

/**
 * Refresh token request DTO
 */
export interface RefreshDto {
    /** Refresh token (required in header mode) */
    refreshToken?: string;
}

/**
 * Forgot password request DTO
 */
export interface ForgotPasswordDto {
    /** User email address */
    email?: string;
    /** User phone number */
    phone?: string;
}

/**
 * Reset password request DTO (using token from verifyForgotPasswordOtp)
 */
export interface ResetPasswordDto {
    /** Reset token from OTP verification */
    token: string;
    /** New password */
    newPassword: string;
}

/**
 * Verify email request DTO
 */
export interface VerifyEmailDto {
    /** Verification token from email link */
    token: string;
}

/**
 * Resend verification email request DTO
 */
export interface ResendVerificationDto {
    /** User email address */
    email?: string;
}

/**
 * Change password request DTO
 */
export interface ChangePasswordDto {
    /** Current password */
    currentPassword: string;
    /** New password */
    newPassword: string;
}

/**
 * 2FA verification request DTO
 */
export interface Verify2faDto {
    /** 2FA code */
    code: string;
    /** Method used (email, phone, totp) */
    method?: 'email' | 'phone' | 'totp';
    /** Whether to trust this device */
    trustDevice?: boolean;
}

// ============================================================================
// Response DTOs
// ============================================================================

/**
 * Authentication response (login/signup success)
 */
export interface AuthResponse extends TokenPair {
    /** Success message */
    message?: string;
    /** Whether MFA is required */
    isRequiresMfa?: boolean;
    /** User information */
    user?: AuthUser;
}

/**
 * Me endpoint response
 */
export interface MeResponse extends AuthUser { }

/**
 * Message response for operations that return only a message
 */
export interface MessageResponse {
    message: string;
}

/**
 * Verify OTP response
 */
export interface VerifyOtpResponse {
    /** Reset token for password reset */
    token: string;
}

/**
 * 2FA verification response
 */
export interface Verify2faResponse extends TokenPair {
    /** Success message */
    message?: string;
    /** Trust token for trusted devices */
    trustToken?: string;
}

/**
 * Session verification response (lightweight check)
 */
export interface SessionVerifyResponse {
    /** Whether the session is valid */
    valid: boolean;
    /** User ID if valid */
    userId?: string;
    /** Session expiration time */
    expiresAt?: string;
}

