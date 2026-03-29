"use client";

/**
 * Auth provider component for React
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    AuthClient,
    IAuthUser,
    IMessageResponse,
    ClientSession,
    AuthError,
    AuthStatus,
    ILoginRequest,
    ISignupRequest,
    IVerify2faRequest,
    IForgotPasswordRequest,
    IVerifyForgotPasswordOtpRequest,
    IVerifyEmailRequest,
    IResendVerificationRequest,
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    IVerifyPhoneRequest,
    IChangePasswordRequest,
    IResetPasswordWithTokenRequest,
    IVerifyTotpSetupRequest,
    IToggleMfaRequest,
    ISwitchTenantRequest,
} from '@ackplus/nest-auth-client';
import { AuthContext, AuthContextValue } from './auth-context';

/**
 * Initial auth state for SSR hydration
 */
export interface InitialAuthState {
    user?: IAuthUser | null;
    session?: ClientSession | null;
    status?: AuthStatus;
}

/**
 * Props for AuthProvider component
 */
export interface AuthProviderProps {
    /** AuthClient instance */
    client: AuthClient;
    /** Initial state for SSR hydration */
    initialState?: InitialAuthState;
    /** Whether to automatically load user on mount (default: true) */
    autoLoadMe?: boolean;
    /** Callback when user becomes unauthenticated */
    onUnauthenticated?: () => void;
    /** Callback when tokens are set (can be async) - use to set tokens in API headers/storage */
    onTokensSet?: (tokens: { accessToken: string; refreshToken: string; trustToken?: string }) => void | Promise<void>;
    /** Callback when tokens are removed (can be async) - use to remove tokens from API/storage */
    onTokensRemoved?: () => void | Promise<void>;
    /** Children components */
    children: React.ReactNode;
}

/**
 * Auth provider component
 * 
 * Wrap your app with this provider to enable authentication throughout your React app.
 * 
 * @example
 * ```tsx
 * import { AuthClient } from '@ackplus/nest-auth-client';
 * import { AuthProvider } from '@ackplus/nest-auth-react';
 * 
 * const client = new AuthClient({ baseUrl: 'http://localhost:3000' });
 * 
 * function App() {
 *   return (
 *     <AuthProvider client={client}>
 *       <YourApp />
 *     </AuthProvider>
 *   );
 * }
 * ```
 */
export function AuthProvider({
    client,
    initialState,
    autoLoadMe = true,
    onUnauthenticated,
    onTokensSet,
    onTokensRemoved,
    children,
}: AuthProviderProps) {
    // Initialize state from client or initial state
    const [status, setStatus] = useState<AuthStatus>(() => {
        if (initialState?.status) return initialState.status;
        if (initialState?.user) return 'authenticated';
        if (client.getUser()) return 'authenticated';
        return 'loading';
    });

    const [user, setUser] = useState<IAuthUser | null>(() => {
        return initialState?.user ?? client.getUser();
    });

    const [session, setSession] = useState<ClientSession | null>(() => {
        return initialState?.session ?? client.getSession();
    });

    const [error, setError] = useState<AuthError | null>(null);

    // Track if we've done the initial load
    const initialLoadRef = useRef(false);
    const onUnauthenticatedRef = useRef(onUnauthenticated);
    onUnauthenticatedRef.current = onUnauthenticated;

    // Subscribe to client events
    useEffect(() => {
        const unsubscribeAuthState = client.onAuthStateChange((newUser) => {
            setUser(newUser);
            setStatus(newUser ? 'authenticated' : 'unauthenticated');

            if (!newUser && initialLoadRef.current) {
                onUnauthenticatedRef.current?.();
            }
        });

        const unsubscribeError = client.onError((err) => {
            setError(err);
        });

        const unsubscribeTokensSet = client.onTokensSet(async (tokens) => {
            if (onTokensSet) {
                await Promise.resolve(onTokensSet(tokens));
            }
        });

        const unsubscribeTokensRemoved = client.onTokensRemoved(async () => {
            if (onTokensRemoved) {
                await Promise.resolve(onTokensRemoved());
            }
        });

        return () => {
            unsubscribeAuthState();
            unsubscribeError();
            unsubscribeTokensSet();
            unsubscribeTokensRemoved();
        };
    }, [client, onTokensSet, onTokensRemoved]);

    // Auto load user on mount
    useEffect(() => {
        if (!autoLoadMe || initialLoadRef.current) return;
        if (initialState?.user !== undefined) {
            initialLoadRef.current = true;
            if (!initialState.user) {
                setStatus('unauthenticated');
            }
            return;
        }

        const loadUser = async () => {
            try {
                const verfyResponce = await client.verifySession();
                if (verfyResponce?.valid) {
                    setUser(client.getUser());
                    setSession(client.getSession());
                    setStatus('authenticated');
                } else {
                    setUser(null);
                    setSession(null);
                    setStatus('unauthenticated');
                }
            } catch {
                setUser(null);
                setSession(null);
                setStatus('unauthenticated');
            } finally {
                initialLoadRef.current = true;
            }
        };

        loadUser();
    }, [client, autoLoadMe, initialState]);

    const updatedSession = useCallback(async () => {
        setUser(client.getUser());
        setSession(client.getSession());
        setStatus('authenticated');
    }, []);

    // Actions
    const login = useCallback(async (dto: ILoginRequest) => {
        setError(null);
        try {
            const response = await client.login(dto);
            updatedSession();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, updatedSession]);

    const signup = useCallback(async (dto: ISignupRequest) => {
        setError(null);
        try {
            const response = await client.signup(dto);
            updatedSession();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, updatedSession]);

    const logout = useCallback(async () => {
        setError(null);
        try {
            await client.logout();
            setUser(null);
            setSession(null);
            setStatus('unauthenticated');
        } catch (err) {
            // Still clear local state even if server logout fails
            setUser(null);
            setSession(null);
            setStatus('unauthenticated');
        }
    }, [client]);

    const logoutAll = useCallback(async (): Promise<IMessageResponse> => {
        setError(null);
        try {
            const response = await client.logoutAll();
            setUser(null);
            setSession(null);
            setStatus('unauthenticated');
            return response;
        } catch (err) {
            // Still clear local state even if server logout fails
            setUser(null);
            setSession(null);
            setStatus('unauthenticated');
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const tokens = await client.refresh();
            setSession(client.getSession());
            return tokens;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const verifySession = useCallback(async () => {
        setError(null);
        try {
            const verifyResponce = await client.verifySession();
            if (verifyResponce?.valid) {
                updatedSession();
            }
            return verifyResponce?.valid;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, updatedSession]);

    const verify2fa = useCallback(async (dto: IVerify2faRequest) => {
        setError(null);
        try {
            const response = await client.verify2fa(dto);
            updatedSession();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, updatedSession]);

    const switchTenant = useCallback(async (dto: ISwitchTenantRequest) => {
        setError(null);
        try {
            const response = await client.switchTenant(dto);
            updatedSession();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, updatedSession]);

    // Password Management
    const forgotPassword = useCallback(async (dto: IForgotPasswordRequest) => {
        setError(null);
        try {
            return await client.forgotPassword(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const verifyForgotPasswordOtp = useCallback(async (dto: IVerifyForgotPasswordOtpRequest) => {
        setError(null);
        try {
            return await client.verifyForgotPasswordOtp(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const resetPassword = useCallback(async (dto: IResetPasswordWithTokenRequest) => {
        setError(null);
        try {
            return await client.resetPassword(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const changePassword = useCallback(async (dto: IChangePasswordRequest) => {
        setError(null);
        try {
            return await client.changePassword(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    // Email Verification
    const verifyEmail = useCallback(async (dto: IVerifyEmailRequest) => {
        setError(null);
        try {
            const response = await client.verifyEmail(dto);
            // Update local user state to reflect verified status
            if (user) {
                setUser({ ...user, isVerified: true });
            }
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, user]);

    const sendEmailVerification = useCallback(async (dto?: ISendEmailVerificationRequest) => {
        setError(null);
        try {
            return await client.sendEmailVerification(dto ?? {});
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const sendPhoneVerification = useCallback(async (dto?: ISendPhoneVerificationRequest) => {
        setError(null);
        try {
            return await client.sendPhoneVerification(dto ?? {});
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const verifyPhone = useCallback(async (dto: IVerifyPhoneRequest) => {
        setError(null);
        try {
            return await client.verifyPhone(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    // 2FA
    const send2fa = useCallback(async (method: 'email' | 'phone' = 'email') => {
        setError(null);
        try {
            return await client.send2fa(method);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    // TOTP / MFA Management
    const setupTotp = useCallback(async () => {
        setError(null);
        try {
            return await client.setupTotp();
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const verifyTotpSetup = useCallback(async (dto: IVerifyTotpSetupRequest) => {
        setError(null);
        try {
            return await client.verifyTotpSetup(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const getMfaStatus = useCallback(async () => {
        setError(null);
        try {
            return await client.getMfaStatus();
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const listTotpDevices = useCallback(async () => {
        setError(null);
        try {
            return await client.listTotpDevices();
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const removeTotpDevice = useCallback(async (deviceId: string) => {
        setError(null);
        try {
            return await client.removeTotpDevice(deviceId);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const toggleMfa = useCallback(async (dto: IToggleMfaRequest) => {
        setError(null);
        try {
            return await client.toggleMfa(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const generateRecoveryCode = useCallback(async () => {
        setError(null);
        try {
            return await client.generateRecoveryCode();
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const resetMfa = useCallback(async (code: string) => {
        setError(null);
        try {
            return await client.resetMfa(code);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    // Mode & Tenant
    const setMode = useCallback((mode: 'header' | 'cookie') => {
        client.setMode(mode);
    }, [client]);

    const getMode = useCallback(() => {
        return client.getMode();
    }, [client]);

    const setTenantId = useCallback((id: string) => {
        client.setTenantId(id);
    }, [client]);

    const getTenantId = useCallback(() => {
        return client.getTenantId();
    }, [client]);

    // Memoize context value
    const contextValue: AuthContextValue = useMemo(() => ({
        status,
        user,
        session,
        error,
        isLoading: status === 'loading',
        isAuthenticated: status === 'authenticated' && user !== null,
        client,
        // Core auth
        updatedSession,
        login,
        signup,
        logout,
        logoutAll,
        refresh,
        verifySession,
        verify2fa,
        switchTenant,
        // Password management
        forgotPassword,
        verifyForgotPasswordOtp,
        resetPassword,
        changePassword,
        // Email / phone verification
        verifyEmail,
        sendEmailVerification,
        sendPhoneVerification,
        verifyPhone,
        // 2FA
        send2fa,
        // TOTP / MFA Management
        setupTotp,
        verifyTotpSetup,
        getMfaStatus,
        listTotpDevices,
        removeTotpDevice,
        toggleMfa,
        generateRecoveryCode,
        resetMfa,
        // Mode & Tenant
        setMode,
        getMode,
        setTenantId,
        getTenantId,
    }), [
        status,
        user,
        session,
        error,
        client,
        updatedSession,
        login,
        signup,
        logout,
        logoutAll,
        refresh,
        verifySession,
        verify2fa,
        switchTenant,
        forgotPassword,
        verifyForgotPasswordOtp,
        resetPassword,
        changePassword,
        verifyEmail,
        sendEmailVerification,
        sendPhoneVerification,
        verifyPhone,
        send2fa,
        setupTotp,
        verifyTotpSetup,
        getMfaStatus,
        listTotpDevices,
        removeTotpDevice,
        toggleMfa,
        generateRecoveryCode,
        resetMfa,
        setMode,
        getMode,
        setTenantId,
        getTenantId,
    ]);

    return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}
