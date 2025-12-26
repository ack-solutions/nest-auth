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

    // Actions
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
    login: () => Promise.reject(new Error('AuthProvider not found')),
    signup: () => Promise.reject(new Error('AuthProvider not found')),
    logout: () => Promise.reject(new Error('AuthProvider not found')),
    refresh: () => Promise.reject(new Error('AuthProvider not found')),
    verifySession: () => Promise.reject(new Error('AuthProvider not found')),
    verify2fa: () => Promise.reject(new Error('AuthProvider not found')),
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
