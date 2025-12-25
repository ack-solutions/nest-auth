/**
 * Configuration types for AuthClient
 */

import { AuthUser, AuthError, TokenPair } from './auth.types';

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
 * Endpoint configuration
 * Customize API endpoint paths
 */
export interface EndpointConfig {
    /** Login endpoint (default: /auth/login) */
    login?: string;
    /** Signup endpoint (default: /auth/signup) */
    signup?: string;
    /** Logout endpoint (default: /auth/logout) */
    logout?: string;
    /** Refresh token endpoint (default: /auth/refresh) */
    refresh?: string;
    /** Get current user endpoint (default: /auth/me) */
    me?: string;
    /** Forgot password endpoint (default: /auth/forgot-password) */
    forgotPassword?: string;
    /** Verify forgot password OTP (default: /auth/verify-forgot-password-otp) */
    verifyForgotPasswordOtp?: string;
    /** Reset password endpoint (default: /auth/reset-password) */
    resetPassword?: string;
    /** Verify email endpoint (default: /auth/verify-email) */
    verifyEmail?: string;
    /** Resend verification endpoint (default: /auth/send-email-verification) */
    resendVerification?: string;
    /** Change password endpoint (default: /auth/change-password) */
    changePassword?: string;
    /** Send 2FA code (default: /auth/2fa/send) */
    send2fa?: string;
    /** Verify 2FA (default: /auth/2fa/verify) */
    verify2fa?: string;
    /** Verify session endpoint (default: /auth/verify-session) */
    verifySession?: string;
}

/**
 * Default endpoint paths
 */
export const DEFAULT_ENDPOINTS: Required<EndpointConfig> = {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    forgotPassword: '/auth/forgot-password',
    verifyForgotPasswordOtp: '/auth/verify-forgot-password-otp',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    resendVerification: '/auth/send-email-verification',
    changePassword: '/auth/change-password',
    send2fa: '/auth/2fa/send',
    verify2fa: '/auth/2fa/verify',
    verifySession: '/auth/verify-session',
};

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
     * Tenant ID for multi-tenant applications
     * Can be a static string or a function that returns the tenant ID
     */
    tenantId?: string | (() => string | undefined);

    /**
     * Header name for tenant ID
     * Default: 'x-tenant-id'
     */
    tenantHeader?: string;

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
}
