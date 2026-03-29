"use client";

/**
 * Auth context for React
 */

import { createContext } from 'react';
import {
    AuthClient,
    IAuthUser,
    ClientSession,
    AuthError,
    AuthStatus,
    ILoginRequest,
    ISignupRequest,
    ITokenPair,
    IAuthResponse,
    IVerify2faRequest,
    IVerify2faResponse,
    IForgotPasswordRequest,
    IVerifyEmailRequest,
    IVerifyForgotPasswordOtpRequest,
    IResendVerificationRequest,
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    IVerifyPhoneRequest,
    IChangePasswordRequest,
    IMessageResponse,
    IVerifyOtpResponse,
    IResetPasswordWithTokenRequest,
    ITotpSetupResponse,
    IVerifyTotpSetupRequest,
    IMfaStatusResponse,
    IMfaDevice,
    IToggleMfaRequest,
    ISwitchTenantRequest,
} from '@ackplus/nest-auth-client';

/**
 * Auth context value provided to consumers
 */
export interface AuthContextValue {
    /** Current authentication status */
    status: AuthStatus;
    /** Authenticated user or null */
    user: IAuthUser | null;
    /** Current session or null */
    session: ClientSession | null;
    /** Last error or null */
    error: AuthError | null;
    /** Whether the auth state is currently loading */
    isLoading: boolean;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** The underlying AuthClient instance */
    client: AuthClient;

    // Actions - Core Authentication
    /** Login with credentials */
    login: (dto: ILoginRequest) => Promise<IAuthResponse>;
    /** Sign up a new user */
    signup: (dto: ISignupRequest) => Promise<IAuthResponse>;
    /** Logout the current user */
    logout: () => Promise<void>;
    /** Logout from all devices */
    logoutAll: () => Promise<IMessageResponse>;
    /** Refresh tokens */
    refresh: () => Promise<ITokenPair>;
    /** Get current user from server */
    verifySession: () => Promise<boolean>;
    /** Verify 2FA code */
    verify2fa: (dto: IVerify2faRequest) => Promise<IVerify2faResponse>;
    /** Switch active tenant */
    switchTenant: (dto: ISwitchTenantRequest) => Promise<IAuthResponse>;

    // Actions - Password Management
    /** Request password reset (forgot password) */
    forgotPassword: (dto: IForgotPasswordRequest) => Promise<IMessageResponse>;
    /** Verify forgot password OTP */
    verifyForgotPasswordOtp: (dto: IVerifyForgotPasswordOtpRequest) => Promise<IVerifyOtpResponse>;
    /** Reset password with token */
    resetPassword: (dto: IResetPasswordWithTokenRequest) => Promise<IMessageResponse>;
    /** Change password (authenticated) */
    changePassword: (dto: IChangePasswordRequest) => Promise<IMessageResponse>;

    // Actions - Email / phone verification (use `code` in verify DTOs; MFA flows use `otp`)
    /** Verify email address */
    verifyEmail: (dto: IVerifyEmailRequest) => Promise<IMessageResponse>;
    /** Send email verification code (authenticated) */
    sendEmailVerification: (dto?: ISendEmailVerificationRequest) => Promise<IMessageResponse>;
    /** Send phone verification SMS (authenticated) */
    sendPhoneVerification: (dto?: ISendPhoneVerificationRequest) => Promise<IMessageResponse>;
    /** Verify phone with SMS code */
    verifyPhone: (dto: IVerifyPhoneRequest) => Promise<IMessageResponse>;

    // Actions - 2FA
    /** Send 2FA code */
    send2fa: (method?: 'email' | 'phone') => Promise<IMessageResponse>;

    // Actions - TOTP / MFA Management
    /** Setup TOTP device - generates secret and QR code */
    setupTotp: () => Promise<ITotpSetupResponse>;
    /** Verify TOTP setup - verifies OTP and marks device as verified */
    verifyTotpSetup: (dto: IVerifyTotpSetupRequest) => Promise<IMessageResponse>;
    /** Get MFA status for current user */
    getMfaStatus: () => Promise<IMfaStatusResponse>;
    /** List all TOTP devices for current user */
    listTotpDevices: () => Promise<IMfaDevice[]>;
    /** Remove a TOTP device */
    removeTotpDevice: (deviceId: string) => Promise<IMessageResponse>;
    /** Toggle MFA on/off for current user */
    toggleMfa: (dto: IToggleMfaRequest) => Promise<IMessageResponse>;
    /** Generate recovery code for MFA */
    generateRecoveryCode: () => Promise<{ code: string }>;
    /** Reset MFA using recovery code */
    resetMfa: (code: string) => Promise<IMessageResponse>;

    // Mode & Tenant
    /** Set token mode (only when config.accessTokenType is null) */
    setMode: (mode: 'header' | 'cookie') => void;
    /** Get current token mode */
    getMode: () => 'header' | 'cookie';
    /** Set tenant ID */
    setTenantId: (id: string) => void;
    /** Get current tenant ID */
    getTenantId: () => string | undefined;
}

/**
 * Default context value (used when provider is missing)
 */
const defaultContextValue: AuthContextValue = {
    status: 'loading',
    user: null,
    session: null,
    error: null,
    isLoading: true,
    isAuthenticated: false,
    client: null as any,
    // Core auth
    login: () => Promise.reject(new Error('AuthProvider not found')),
    signup: () => Promise.reject(new Error('AuthProvider not found')),
    logout: () => Promise.reject(new Error('AuthProvider not found')),
    logoutAll: () => Promise.reject(new Error('AuthProvider not found')),
    refresh: () => Promise.reject(new Error('AuthProvider not found')),
    verifySession: () => Promise.reject(new Error('AuthProvider not found')),
    verify2fa: () => Promise.reject(new Error('AuthProvider not found')),
    switchTenant: () => Promise.reject(new Error('AuthProvider not found')),
    // Password management
    forgotPassword: () => Promise.reject(new Error('AuthProvider not found')),
    verifyForgotPasswordOtp: () => Promise.reject(new Error('AuthProvider not found')),
    resetPassword: () => Promise.reject(new Error('AuthProvider not found')),
    changePassword: () => Promise.reject(new Error('AuthProvider not found')),
    // Email verification
    verifyEmail: () => Promise.reject(new Error('AuthProvider not found')),
    sendEmailVerification: () => Promise.reject(new Error('AuthProvider not found')),
    sendPhoneVerification: () => Promise.reject(new Error('AuthProvider not found')),
    verifyPhone: () => Promise.reject(new Error('AuthProvider not found')),
    // 2FA
    send2fa: () => Promise.reject(new Error('AuthProvider not found')),
    // TOTP / MFA Management
    setupTotp: () => Promise.reject(new Error('AuthProvider not found')),
    verifyTotpSetup: () => Promise.reject(new Error('AuthProvider not found')),
    getMfaStatus: () => Promise.reject(new Error('AuthProvider not found')),
    listTotpDevices: () => Promise.reject(new Error('AuthProvider not found')),
    removeTotpDevice: () => Promise.reject(new Error('AuthProvider not found')),
    toggleMfa: () => Promise.reject(new Error('AuthProvider not found')),
    generateRecoveryCode: () => Promise.reject(new Error('AuthProvider not found')),
    resetMfa: () => Promise.reject(new Error('AuthProvider not found')),
    // Mode & tenant
    setMode: () => { throw new Error('AuthProvider not found'); },
    getMode: () => 'header',
    setTenantId: () => { throw new Error('AuthProvider not found'); },
    getTenantId: () => undefined,
};

/**
 * React context for authentication
 */
export const AuthContext = createContext<AuthContextValue>(defaultContextValue);

AuthContext.displayName = 'AuthContext';
