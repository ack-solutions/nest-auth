/**
 * Passwordless login — OTP (email/SMS) and magic link.
 * Uses `code` in verify requests (same as other verification flows; MFA still uses `otp`).
 */

export type PasswordlessChannel = 'email' | 'sms';

/** Request a one-time code for passwordless login (email or SMS). */
export interface IPasswordlessSendRequest {
    /** Email address or phone number, depending on `channel`. */
    identifier: string;
    channel: PasswordlessChannel;
    tenantId?: string;
}
