/**
 * Emitted when a login attempt fails. Feeds the audit trail (HIPAA §164.312(b)
 * requires recording failed access attempts) and security monitoring / lockout.
 *
 * The user is intentionally NOT resolved (the attempt failed), so we carry the
 * best-effort `identifier` (email/phone/oauth-id the caller presented) instead.
 */
export interface LoginFailedEventPayload {
    /** Best-effort identifier the attempt used (email / phone / provider id). May be undefined. */
    identifier?: string;
    /** Provider the attempt targeted ('email' | 'phone' | 'google' | ...). */
    providerName?: string;
    /** Stable error code (e.g. INVALID_CREDENTIALS, ACCOUNT_INACTIVE). */
    reasonCode?: string;
    /** Human-readable reason (no secrets). */
    reason?: string;
    /** Source IP, if resolvable from the request context. */
    ip?: string;
    /** User agent, if resolvable. */
    userAgent?: string;
    /** Tenant context, if any. */
    tenantId?: string | null;
    at: Date;
}

export class LoginFailedEvent {
    constructor(public readonly payload: LoginFailedEventPayload) {}
}
