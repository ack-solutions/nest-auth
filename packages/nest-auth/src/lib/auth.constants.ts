export const AUTH_MODULE_OPTIONS = 'NEST_AUTH_AUTH_MODULE_OPTIONS';
export const NEST_AUTH_ASYNC_OPTIONS_PROVIDER = 'NEST_AUTH_ASYNC_OPTIONS_PROVIDER';

/** Injection token for tenant context service (abstraction for disabled / ISOLATED / SHARED). */
export const NEST_AUTH_TENANT_CONTEXT_SERVICE = 'NEST_AUTH_TENANT_CONTEXT_SERVICE';

export const JWT_AUTH_PROVIDER = 'jwt';
export const GOOGLE_AUTH_PROVIDER = 'google';
export const FACEBOOK_AUTH_PROVIDER = 'facebook';
export const APPLE_AUTH_PROVIDER = 'apple';
export const GITHUB_AUTH_PROVIDER = 'github';
export const EMAIL_AUTH_PROVIDER = 'email';
export const PHONE_AUTH_PROVIDER = 'phone';
/** Login via `POST /auth/login` with `providerName: 'passwordless'` and OTP or magic-link credentials (after send endpoints). */
export const PASSWORDLESS_AUTH_PROVIDER = 'passwordless';


// Key for optional auth metadata
export const OPTIONAL_AUTH_KEY = 'optional_auth';
/** Reflector metadata key naming a route's rate-limit bucket (see @RateLimit). */
export const RATE_LIMIT_BUCKET_KEY = 'nest_auth_rate_limit_bucket';
/** Reflector metadata key marking a route as lockout-checked (see @Lockout). */
export const LOCKOUT_KEY = 'nest_auth_lockout';
/** Reflector metadata key marking a route as CAPTCHA-protected (see @Captcha). */
export const CAPTCHA_KEY = 'nest_auth_captcha';

// ==========================================
// ERROR CODES - Categorized for better organization
// ==========================================

// Authentication Error Codes
export const AUTH_ERROR_CODES = {
    // Signup/Registration
    REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
    EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
    PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
    EMAIL_DOMAIN_NOT_ALLOWED: 'EMAIL_DOMAIN_NOT_ALLOWED',
    PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',

    // Login
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INVALID_PROVIDER: 'INVALID_PROVIDER',
    MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
    PASSWORDLESS_DISABLED: 'PASSWORDLESS_DISABLED',
    MAGIC_LINK_URL_NOT_CONFIGURED: 'MAGIC_LINK_URL_NOT_CONFIGURED',

    // Account Status
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
    SOCIAL_EMAIL_NOT_VERIFIED: 'SOCIAL_EMAIL_NOT_VERIFIED',

    // CSRF (cookie-authenticated state-changing requests)
    CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
    CSRF_ORIGIN_REJECTED: 'CSRF_ORIGIN_REJECTED',

    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',

    // Account lockout / CAPTCHA
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
    CAPTCHA_FAILED: 'CAPTCHA_FAILED',

    // Password
    CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
    NEW_PASSWORD_SAME_AS_CURRENT: 'NEW_PASSWORD_SAME_AS_CURRENT',
    // Password policy
    PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
    PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
    PASSWORD_TOO_COMMON: 'PASSWORD_TOO_COMMON',
    PASSWORD_CONTAINS_IDENTIFIER: 'PASSWORD_CONTAINS_IDENTIFIER',
    PASSWORD_BREACHED: 'PASSWORD_BREACHED',
    PASSWORD_RESET_INVALID_REQUEST: 'PASSWORD_RESET_INVALID_REQUEST',
    PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',
    PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',

    // Tokens
    REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
    REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    // Email Verification
    EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
    VERIFICATION_CODE_INVALID: 'VERIFICATION_CODE_INVALID',
    VERIFICATION_CODE_EXPIRED: 'VERIFICATION_CODE_EXPIRED',
    NO_EMAIL_ADDRESS: 'NO_EMAIL_ADDRESS',
    NO_PHONE_NUMBER: 'NO_PHONE_NUMBER',
    PHONE_ALREADY_VERIFIED: 'PHONE_ALREADY_VERIFIED',
} as const;

// MFA Error Codes
export const MFA_ERROR_CODES = {
    MFA_NOT_ENABLED: 'MFA_NOT_ENABLED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
    MFA_CODE_INVALID: 'MFA_CODE_INVALID',
    MFA_CODE_EXPIRED: 'MFA_CODE_EXPIRED',
    MFA_METHOD_NOT_AVAILABLE: 'MFA_METHOD_NOT_AVAILABLE',
    MFA_TOGGLING_NOT_ALLOWED: 'MFA_TOGGLING_NOT_ALLOWED',
    MFA_CANNOT_ENABLE_WITHOUT_METHOD: 'MFA_CANNOT_ENABLE_WITHOUT_METHOD',
    MFA_RECOVERY_CODE_INVALID: 'MFA_RECOVERY_CODE_INVALID',
    TOTP_SETUP_FAILED: 'TOTP_SETUP_FAILED',
    TOTP_VERIFICATION_FAILED: 'TOTP_VERIFICATION_FAILED',
} as const;

// Session Error Codes
export const SESSION_ERROR_CODES = {
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_INVALID: 'SESSION_INVALID',
    MAX_SESSIONS_REACHED: 'MAX_SESSIONS_REACHED',
} as const;

// Guard Error Codes
export const GUARD_ERROR_CODES = {
    NO_AUTH_PROVIDED: 'NO_AUTH_PROVIDED',
    INVALID_AUTH_FORMAT: 'INVALID_AUTH_FORMAT',
    INVALID_AUTH_TYPE: 'INVALID_AUTH_TYPE',
    UNAUTHORIZED: 'UNAUTHORIZED',
    ACCESS_DENIED: 'ACCESS_DENIED',
    FORBIDDEN: 'FORBIDDEN',
    NO_ROLES_ASSIGNED: 'NO_ROLES_ASSIGNED',
    MISSING_REQUIRED_ROLES: 'MISSING_REQUIRED_ROLES',
    MISSING_REQUIRED_PERMISSIONS: 'MISSING_REQUIRED_PERMISSIONS',
    GUARD_MISMATCH: 'GUARD_MISMATCH',
    GUARD_NOT_ALLOWED: 'GUARD_NOT_ALLOWED',
} as const;

// API Key Error Codes
export const API_KEY_ERROR_CODES = {
    INVALID_API_KEY_FORMAT: 'INVALID_API_KEY_FORMAT',
    INVALID_API_KEY: 'INVALID_API_KEY',
    API_KEY_EXPIRED: 'API_KEY_EXPIRED',
    API_KEY_DEACTIVATED: 'API_KEY_DEACTIVATED',
    API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
} as const;

// Validation Error Codes
export const VALIDATION_ERROR_CODES = {
    EMAIL_OR_PHONE_REQUIRED: 'EMAIL_OR_PHONE_REQUIRED',
    TENANT_ID_REQUIRED: 'TENANT_ID_REQUIRED',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
    INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',
} as const;

// OTP Error Codes
export const OTP_ERROR_CODES = {
    OTP_INVALID: 'OTP_INVALID',
    OTP_EXPIRED: 'OTP_EXPIRED',
    OTP_ALREADY_USED: 'OTP_ALREADY_USED',
    OTP_NOT_FOUND: 'OTP_NOT_FOUND',
} as const;

// User Management Error Codes
export const USER_ERROR_CODES = {
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    USER_CREATION_FAILED: 'USER_CREATION_FAILED',
    USER_UPDATE_FAILED: 'USER_UPDATE_FAILED',
    USER_DELETION_FAILED: 'USER_DELETION_FAILED',
} as const;

// Tenant Error Codes
export const TENANT_ERROR_CODES = {
    TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
    TENANT_ALREADY_EXISTS: 'TENANT_ALREADY_EXISTS',
    INVALID_TENANT: 'INVALID_TENANT',
    /** A `tenantId` was supplied, but `tenant.enabled = false` on the server. */
    TENANT_NOT_ENABLED: 'TENANT_NOT_ENABLED',
    /** `switchTenant` called when multi-tenancy is disabled. */
    TENANT_SWITCHING_DISABLED: 'TENANT_SWITCHING_DISABLED',
    /** `switchTenant` called in ISOLATED mode (semantically meaningless). */
    TENANT_SWITCHING_NOT_SUPPORTED: 'TENANT_SWITCHING_NOT_SUPPORTED',
    /** Caller authenticated, but has no `userAccess`/`platformAccess` for the target tenant. */
    NOT_A_MEMBER_OF_TENANT: 'NOT_A_MEMBER_OF_TENANT',
} as const;

// Consolidated Error Codes (for easy access)
export const ERROR_CODES = {
    ...AUTH_ERROR_CODES,
    ...MFA_ERROR_CODES,
    ...SESSION_ERROR_CODES,
    ...GUARD_ERROR_CODES,
    ...API_KEY_ERROR_CODES,
    ...VALIDATION_ERROR_CODES,
    ...OTP_ERROR_CODES,
    ...USER_ERROR_CODES,
    ...TENANT_ERROR_CODES,
} as const;

// Type for error codes
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];


// Auth Cookie Names
export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

// Multi-account (cookie mode): non-httpOnly selector cookie naming which of the
// per-account token cookies is "active". Non-httpOnly so the browser SDK can set
// it to switch accounts client-side; the server reads it to pick the cookie.
export const ACTIVE_ACCOUNT_COOKIE_NAME = 'nest_auth_active_account';

// "Remember me" (cookie mode): a session-scoped marker the server writes when a
// login opted OUT of persistence, so subsequent token refreshes keep issuing
// session cookies (sticky across refresh) instead of upgrading to persistent.
export const REMEMBER_COOKIE_NAME = 'nest_auth_remember';
/** Non-httpOnly double-submit CSRF token cookie (cookie-auth mode). */
export const CSRF_COOKIE_NAME = 'nest_auth_csrf';

/** Per-account access-token cookie name. `accountKey` is the user id (cookie-safe). */
export const accountAccessCookieName = (accountKey: string): string =>
    `${ACCESS_TOKEN_COOKIE_NAME}_${accountKey}`;
/** Per-account refresh-token cookie name. */
export const accountRefreshCookieName = (accountKey: string): string =>
    `${REFRESH_TOKEN_COOKIE_NAME}_${accountKey}`;

/** Decode (without verifying) a JWT's payload. Used only to key/label per-account cookies. */
export const jwtPayload = (token: string): any | undefined => {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    } catch {
        return undefined;
    }
};

/** Decode (without verifying) the `sub` (user id) from a JWT — used to key per-account cookies. */
export const userIdFromJwt = (token: string): string | undefined => {
    const payload = jwtPayload(token);
    return payload?.sub ?? payload?.id ?? undefined;
};

export const NEST_AUTH_TRUST_DEVICE_KEY = 'nest_auth_device_trust';

// Default values
export const DEFAULT_GUARD_NAME = 'web';

// Events Const
export const NestAuthEvents = {
    EMAIL_VERIFICATION_REQUESTED: 'email.verification.requested',
    EMAIL_VERIFIED: 'email.verified',
    PHONE_VERIFICATION_REQUESTED: 'phone.verification.requested',
    PHONE_VERIFIED: 'phone.verified',
    // Auth events
    LOGGED_IN: 'nest_auth.logged_in',
    /** A login attempt failed (bad credentials, inactive account, etc.). Required for HIPAA §164.312(b) failed-access logging. */
    LOGIN_FAILED: 'nest_auth.login_failed',
    /** Email/SMS OTP for passwordless login — send the `code` in the listener */
    PASSWORDLESS_CODE_REQUESTED: 'nest_auth.passwordless.code.requested',
    /** Magic link URL built — send email in listener */
    MAGIC_LINK_REQUESTED: 'nest_auth.passwordless.magic_link.requested',
    REGISTERED: 'nest_auth.registered',
    /** A blocked/disposable email domain was seen at sign-up (emitted in `flag` mode). Payload: { email, domain }. */
    DISPOSABLE_EMAIL_DETECTED: 'nest_auth.disposable_email_detected',
    USER_INVITED: 'nest_auth.user_invited',
    TWO_FACTOR_VERIFIED: 'nest_auth.two_factor_verified',
    TWO_FACTOR_CODE_SENT: 'nest_auth.two_factor_code_sent',
    REFRESH_TOKEN: 'nest_auth.refresh_token',
    /** A rotated/replayed refresh token was presented — likely token theft. Payload: { sessionId, userId, revoked }. */
    REFRESH_TOKEN_REUSE_DETECTED: 'nest_auth.refresh_token_reuse_detected',
    PASSWORD_RESET_REQUESTED: 'nest_auth.password_reset_requested',
    PASSWORD_RESET: 'nest_auth.password_reset',
    LOGGED_OUT: 'nest_auth.logged_out',
    LOGGED_OUT_ALL: 'nest_auth.logged_out_all',
    PASSWORD_CHANGED: 'nest_auth.password_changed',
    TWO_FACTOR_ENABLED: 'nest_auth.two_factor_enabled',
    TWO_FACTOR_DISABLED: 'nest_auth.two_factor_disabled',

    // User events
    USER_CREATED: 'nest_auth.user.created',
    USER_UPDATED: 'nest_auth.user.updated',
    USER_DELETED: 'nest_auth.user.deleted',

    // Tenant events
    TENANT_CREATED: 'nest_auth.tenant.created',
    TENANT_UPDATED: 'nest_auth.tenant.updated',
    TENANT_DELETED: 'nest_auth.tenant.deleted',

    // Role events
    ROLE_CREATED: 'nest_auth.role.created',
    ROLE_UPDATED: 'nest_auth.role.updated',
    ROLE_DELETED: 'nest_auth.role.deleted',

    // Permission events
    PERMISSION_CREATED: 'nest_auth.permission.created',
    PERMISSION_UPDATED: 'nest_auth.permission.updated',
    PERMISSION_DELETED: 'nest_auth.permission.deleted',

    // Access key events
    ACCESS_KEY_CREATED: 'nest_auth.access_key.created',
    ACCESS_KEY_DELETED: 'nest_auth.access_key.deleted',
    ACCESS_KEY_UPDATED: 'nest_auth.access_key.updated',
    ACCESS_KEY_DEACTIVATED: 'nest_auth.access_key.deactivated',

    // Admin-console events (listen to send an out-of-band security notification)
    /** A dashboard admin account was created via the secret-key `signup` bootstrap. */
    ADMIN_CREATED: 'nest_auth.admin.created',
    /** A dashboard admin's password was reset via the secret-key `reset-password` endpoint. */
    ADMIN_PASSWORD_RESET: 'nest_auth.admin.password_reset',
} as const;
