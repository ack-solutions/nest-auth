/**
 * Configuration types for AuthClient
 */

import { IAuthUser as AuthUser, ITokenPair as TokenPair } from '@ackplus/nest-auth-contracts';
import { AuthError } from './auth.types';

/**
 * Storage adapter interface
 * Implement this to use custom storage (Redis, AsyncStorage, etc.)
 */
export interface StorageAdapter {
    /**
     * Get a value from storage
     */
    get(key: string): Promise<string | null> | string | null;

    /**
     * Set a value in storage
     */
    set(key: string, value: string): Promise<void> | void;

    /**
     * Remove a value from storage
     */
    remove(key: string): Promise<void> | void;

    /**
     * Clear all auth-related values from storage
     */
    clear?(): Promise<void> | void;
}

/**
 * HTTP adapter interface
 * Implement this to use custom HTTP clients (axios, ky, etc.)
 */
export interface HttpAdapter {
    /**
     * Make an HTTP request
     */
    request<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
    /** Request URL (full or relative to baseUrl) */
    url: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** Request headers */
    headers?: Record<string, string>;
    /** Request body (will be JSON serialized) */
    body?: any;
    /** Credentials mode for cookies */
    credentials?: 'include' | 'omit' | 'same-origin';
    /** Request timeout in ms */
    timeout?: number;
    /** Signal for request cancellation */
    signal?: AbortSignal;
}

/**
 * HTTP response
 */
export interface HttpResponse<T = any> {
    /** HTTP status code */
    status: number;
    /** Response data */
    data: T;
    /** Response headers */
    headers: Record<string, string>;
    /** Whether the request was successful (2xx status) */
    ok: boolean;
}

/**
 * Logger interface
 */
export interface Logger {
    debug?(message: string, ...args: any[]): void;
    info?(message: string, ...args: any[]): void;
    warn?(message: string, ...args: any[]): void;
    error?(message: string, ...args: any[]): void;
}


/**
 * Default endpoint paths
 */
export const DEFAULT_ENDPOINTS = {
    login: '/auth/login',
    passwordlessSend: '/auth/passwordless/send',
    signup: '/auth/signup',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    refresh: '/auth/refresh-token',
    me: '/auth/user',
    forgotPassword: '/auth/forgot-password',
    verifyForgotPasswordOtp: '/auth/verify-forgot-password-otp',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    sendEmailVerification: '/auth/send-email-verification',
    resendVerification: '/auth/send-email-verification',
    sendPhoneVerification: '/auth/send-phone-verification',
    verifyPhone: '/auth/verify-phone',
    changePassword: '/auth/change-password',
    send2fa: '/auth/mfa/challenge',
    verify2fa: '/auth/mfa/verify',
    verifySession: '/auth/verify-session',
    switchTenant: '/auth/switch-tenant',
    setupTotp: '/auth/mfa/setup-totp',
    verifyTotpSetup: '/auth/mfa/verify-totp-setup',
    getMfaStatus: '/auth/mfa/status',
    listTotpDevices: '/auth/mfa/devices',
    removeTotpDevice: '/auth/mfa/devices',
    toggleMfa: '/auth/mfa/toggle',
    generateRecoveryCode: '/auth/mfa/generate-recovery-code',
    resetMfa: '/auth/mfa/reset-totp',
};

export type EndpointConfig = typeof DEFAULT_ENDPOINTS;

/**
 * Token mode for auth client
 * - 'header': Access token sent via Authorization header only
 * - 'cookie': Access token sent via httpOnly cookie (credentials: include)
 * - null: Auto-detect or allow both modes
 */
export type AccessTokenType = 'header' | 'cookie' | null;

/**
 * Main configuration for AuthClient
 */
export interface AuthClientConfig {
    /**
     * Base URL for the auth API
     * Example: 'https://api.example.com' or 'http://localhost:3000'
     */
    baseUrl: string;

    /**
     * Customize API endpoint paths
     */
    endpoints?: EndpointConfig;

    /**
     * Token mode
     * - 'header': Send access token in Authorization header
     * - 'cookie': Use httpOnly cookies (credentials: include)
     * - null: Auto-detect based on response (default)
     */
    accessTokenType?: AccessTokenType;

    /**
     * Storage adapter for persisting tokens/session
     * Default: MemoryStorage (safe for SSR)
     */
    storage?: StorageAdapter;

    /**
     * HTTP adapter for making requests
     * Default: FetchAdapter
     */
    httpAdapter?: HttpAdapter;

    /**
     * Logger for debugging
     */
    logger?: Logger;

    /**
     * Whether to automatically refresh tokens before they expire
     * Default: true
     */
    autoRefresh?: boolean;

    /**
     * Time in seconds before token expiry to trigger auto-refresh
     * Default: 60 (1 minute)
     */
    refreshThreshold?: number;

    /**
     * Header name for trust token (trusted device verification)
     * Default: 'nest_auth_device_trust'
     * Only used in header mode - in cookie mode, trust token is sent via cookies
     */
    trustDeviceHeaderName?: string;


    // ============================================================================
    // Event callbacks
    // ============================================================================

    /**
     * Called when authentication state changes
     */
    onAuthStateChange?: (user: AuthUser | null) => void;

    /**
     * Called when tokens are refreshed
     */
    onTokenRefreshed?: (tokens: TokenPair) => void;

    /**
     * Called when user logs out
     */
    onLogout?: () => void;

    /**
     * Called when an error occurs
     */
    onError?: (error: AuthError) => void;
}

/**
 * Request options for individual API calls
 */
export interface RequestOptions {
    /** Override the default timeout */
    timeout?: number;
    /** Additional headers */
    headers?: Record<string, string>;
    /** AbortController signal for cancellation */
    signal?: AbortSignal;
    /** Skip automatic token refresh on 401 */
    skipRefresh?: boolean;
    /** Skip adding Authorization header */
    skipAuthHeader?: boolean;
}
