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

/**
 * Complete a passwordless login by exchanging the emailed/texted code for a
 * session — the completion step for {@link IPasswordlessSendRequest}. Returns a
 * normal auth response (same as a password login).
 */
export interface IPasswordlessLoginRequest {
    /** Email address or phone number — the same value passed to the send request. */
    identifier: string;
    /** The one-time code from email/SMS. */
    code: string;
    /**
     * Channel(s) to verify the code against. Defaults to trying both
     * (`['email','sms']`) when omitted; pass the channel you sent to for a
     * single-channel check.
     */
    channel?: PasswordlessChannel | PasswordlessChannel[];
    tenantId?: string;
    /** "Remember me" — see `ILoginRequest.rememberMe`. */
    rememberMe?: boolean;
}
