/**
 * Passwordless login — OTP (email/SMS) and magic link.
 * Uses `code` in verify requests (same as other verification flows; MFA still uses `otp`).
 */

/**
 * `ILoginRequest.providerName` value for passwordless login (OTP / magic link).
 * Matches the server constant `PASSWORDLESS_AUTH_PROVIDER` in `@ackplus/nest-auth`.
 */
export const NEST_AUTH_PASSWORDLESS_PROVIDER = 'passwordless' as const;

export type PasswordlessChannel = 'email' | 'sms';

/** Request a one-time code for passwordless login (email or SMS). */
export interface IPasswordlessSendRequest {
    /** Email address or phone number, depending on `channel`. */
    identifier: string;
    channel: PasswordlessChannel;
    tenantId?: string;
}
