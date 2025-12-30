export const AUTH_MODULE_OPTIONS = 'NEST_AUTH_AUTH_MODULE_OPTIONS';
export const NEST_AUTH_ASYNC_OPTIONS_PROVIDER = 'NEST_AUTH_ASYNC_OPTIONS_PROVIDER';


// Provider tokens
export const JWT_AUTH_PROVIDER = 'jwt';
export const GOOGLE_AUTH_PROVIDER = 'google';
export const FACEBOOK_AUTH_PROVIDER = 'facebook';
export const APPLE_AUTH_PROVIDER = 'apple';
export const GITHUB_AUTH_PROVIDER = 'github';
export const EMAIL_AUTH_PROVIDER = 'email';
export const PHONE_AUTH_PROVIDER = 'phone';


// Key for optional auth metadata
export const OPTIONAL_AUTH_KEY = 'optional_auth';

// ==========================================
// ERROR CODES - Categorized for better organization
// ==========================================

// Authentication Error Codes
export const AUTH_ERROR_CODES = {
    // Signup/Registration
    REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
    EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
    PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
    PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',

    // Login
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INVALID_PROVIDER: 'INVALID_PROVIDER',
    MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',

    // Account Status
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',

    // Password
    CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
    NEW_PASSWORD_SAME_AS_CURRENT: 'NEW_PASSWORD_SAME_AS_CURRENT',
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
} as const;

// MFA Error Codes
export const MFA_ERROR_CODES = {
    MFA_NOT_ENABLED: 'MFA_NOT_ENABLED',
    MFA_REQUIRED: 'MFA_REQUIRED',
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

export const NEST_AUTH_TRUST_DEVICE_KEY = 'nest_auth_device_trust';

// Default values
export const DEFAULT_GUARD_NAME = 'web';

// Events Const
export const NestAuthEvents = {
    EMAIL_VERIFICATION_REQUESTED: 'email.verification.requested',
    EMAIL_VERIFIED: 'email.verified',
    // Auth events
    LOGGED_IN: 'nest_auth.logged_in',
    REGISTERED: 'nest_auth.registered',
    TWO_FACTOR_VERIFIED: 'nest_auth.two_factor_verified',
    TWO_FACTOR_CODE_SENT: 'nest_auth.two_factor_code_sent',
    REFRESH_TOKEN: 'nest_auth.refresh_token',
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

    // Access key events
    ACCESS_KEY_CREATED: 'nest_auth.access_key.created',
    ACCESS_KEY_DELETED: 'nest_auth.access_key.deleted',
    ACCESS_KEY_UPDATED: 'nest_auth.access_key.updated',
    ACCESS_KEY_DEACTIVATED: 'nest_auth.access_key.deactivated',
} as const;
