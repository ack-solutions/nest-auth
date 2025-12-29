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
    IResendVerificationRequest,
    IChangePasswordRequest,
    IMessageResponse,
    IVerifyOtpResponse,
    IResetPasswordWithTokenRequest,
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
    /** Refresh tokens */
    refresh: () => Promise<ITokenPair>;
    /** Get current user from server */
    verifySession: () => Promise<boolean>;
    /** Verify 2FA code */
    verify2fa: (dto: IVerify2faRequest) => Promise<IVerify2faResponse>;

    // Actions - Password Management
    /** Request password reset (forgot password) */
    forgotPassword: (dto: IForgotPasswordRequest) => Promise<IMessageResponse>;
    /** Verify forgot password OTP */
    verifyForgotPasswordOtp: (dto: { email?: string; phone?: string; otp: string }) => Promise<IVerifyOtpResponse>;
    /** Reset password with token */
    resetPassword: (dto: IResetPasswordWithTokenRequest) => Promise<IMessageResponse>;
    /** Change password (authenticated) */
    changePassword: (dto: IChangePasswordRequest) => Promise<IMessageResponse>;

    // Actions - Email Verification
    /** Verify email address */
    verifyEmail: (dto: IVerifyEmailRequest) => Promise<IMessageResponse>;
    /** Resend verification email */
    resendVerification: (dto: IResendVerificationRequest) => Promise<IMessageResponse>;

    // Actions - 2FA
    /** Send 2FA code */
    send2fa: (method?: 'email' | 'phone') => Promise<IMessageResponse>;

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
    refresh: () => Promise.reject(new Error('AuthProvider not found')),
    verifySession: () => Promise.reject(new Error('AuthProvider not found')),
    verify2fa: () => Promise.reject(new Error('AuthProvider not found')),
    // Password management
    forgotPassword: () => Promise.reject(new Error('AuthProvider not found')),
    verifyForgotPasswordOtp: () => Promise.reject(new Error('AuthProvider not found')),
    resetPassword: () => Promise.reject(new Error('AuthProvider not found')),
    changePassword: () => Promise.reject(new Error('AuthProvider not found')),
    // Email verification
    verifyEmail: () => Promise.reject(new Error('AuthProvider not found')),
    resendVerification: () => Promise.reject(new Error('AuthProvider not found')),
    // 2FA
    send2fa: () => Promise.reject(new Error('AuthProvider not found')),
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
