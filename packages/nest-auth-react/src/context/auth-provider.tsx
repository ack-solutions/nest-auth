"use client";

/**
 * Auth provider component for React
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    AuthClient,
    ISessionUserData,
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
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    IVerifyPhoneRequest,
    IChangePasswordRequest,
    IResetPasswordWithTokenRequest,
    IVerifyTotpSetupRequest,
    ISetupTotpRequest,
    IToggleMfaRequest,
    ISwitchTenantRequest,
    IPasswordlessSendRequest,
    IPasswordlessLoginRequest,
} from '@ackplus/nest-auth-client';
import { AuthContext, AuthContextValue } from './auth-context';
import { decideVerifyOutcome, verifyOutcomeFromResult, verifyOutcomeFromError, type VerifyOutcome } from './verify-outcome';

/**
 * Initial auth state for SSR hydration
 */
export interface InitialAuthState {
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
    onUnauthenticated,
    onTokensSet,
    onTokensRemoved,
    children,
}: AuthProviderProps) {
    // Initialize state from client or initial state
    const [status, setStatus] = useState<AuthStatus>(() => {
        if (initialState?.status) return initialState.status;
        return 'loading';
    });
    const [sessionDataLoading, setSessionDataLoading] = useState<boolean>(false);
    const [sessionData, setSessionData] = useState<ISessionUserData | null>(null);

    const [session, setSession] = useState<ClientSession | null>(() => {
        return initialState?.session ?? client.getSession();
    });

    const [error, setError] = useState<AuthError | null>(null);

    // Track if we've done the initial load
    const initialLoadRef = useRef(false);
    const onUnauthenticatedRef = useRef(onUnauthenticated);
    onUnauthenticatedRef.current = onUnauthenticated;
    // Latest status, readable inside async callbacks without stale closures — the
    // verify-outcome decision needs to know the previous status.
    const statusRef = useRef(status);
    statusRef.current = status;

    const getSessionData = useCallback(async () => {
        setSessionDataLoading(true);
        try {
            const nextSessionData = await client.getSessionUserData();
            setSessionData(nextSessionData);
            setSession(client.getSession());
            setStatus('authenticated');
            return nextSessionData;
        } catch (err) {
            setSessionData(null);
            setSession(client.getSession());
            if (!client.getIsAuthenticated()) {
                setStatus('unauthenticated');
            }
            throw err;
        } finally {
            setSessionDataLoading(false);
        }
    }, [client]);

    // Subscribe to client events
    useEffect(() => {
        const unsubscribeRefreshSessionData = client.onRefreshSessionData(async () => {
            await getSessionData();
        });

        const unsubscribeError = client.onError((err) => {
            setError(err);
        });

        const unsubscribeTokensSet = client.onTokensSet(async (tokens) => {
            if (onTokensSet) {
                await Promise.resolve(onTokensSet(tokens));
            }
        });
        const unsubscribeTokenRefreshed = client.onTokenRefreshed(async () => {
            await getSessionData();
        });

        const unsubscribeTokensRemoved = client.onTokensRemoved(async () => {
            if (onTokensRemoved) {
                await Promise.resolve(onTokensRemoved());
            }
        });

        return () => {
            unsubscribeError();
            unsubscribeTokensSet();
            unsubscribeTokenRefreshed();
            unsubscribeTokensRemoved();
            unsubscribeRefreshSessionData();
        };
    }, [client, onTokensSet, onTokensRemoved, getSessionData]);

    // Auto load user on mount. Swallow the rejection: an indeterminate failure
    // (server outage) is surfaced via the provider's `error` state, and must NOT
    // become an unhandled promise rejection or log the user out.
    useEffect(() => {
        verifySession().catch(() => { /* surfaced via error state; never logs out */ });
    }, [client]);


    // Actions
    const login = useCallback(async (dto: ILoginRequest) => {
        setError(null);
        try {
            const response = await client.login(dto);

            if (!response.isRequiresMfa) {
                await getSessionData();
            }

            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, getSessionData]);


    const signup = useCallback(async (dto: ISignupRequest) => {
        setError(null);
        try {
            const response = await client.signup(dto);
            await getSessionData();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, getSessionData]);

    const logout = useCallback(async () => {
        setError(null);
        try {
            await client.logout();
            setSessionData(null);
            setSession(null);
            setStatus('unauthenticated');
        } catch (err) {
            // Still clear local state even if server logout fails
            setSessionData(null);
            setSession(null);
            setStatus('unauthenticated');
        }
    }, [client]);

    const logoutAll = useCallback(async (): Promise<IMessageResponse> => {
        setError(null);
        try {
            const response = await client.logoutAll();
            setSessionData(null);
            setSession(null);
            setStatus('unauthenticated');
            return response;
        } catch (err) {
            // Still clear local state even if server logout fails
            setSessionData(null);
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

        // Reduce the verify call to a single outcome: valid, definitively
        // rejected (401/403), or indeterminate (couldn't ask). The client returns
        // { valid: false } ONLY on a definitive rejection and THROWS (with
        // `error.kind`) on anything indeterminate.
        let outcome: VerifyOutcome;
        try {
            outcome = verifyOutcomeFromResult(await client.verifySession());
        } catch (err) {
            // Only a `kind: 'rejected'` throw is a definitive rejection; any other
            // error is indeterminate, so we never redirect on a network/server
            // failure.
            outcome = verifyOutcomeFromError(err as AuthError);
        }

        const decision = decideVerifyOutcome(outcome, statusRef.current);

        if (decision.clearSession) {
            setSessionData(null);
            setSession(null);
        }
        setStatus(decision.status);
        setError(decision.error);
        if (decision.signalUnauthenticated) {
            onUnauthenticatedRef.current?.();
        }

        if (decision.loadProfile) {
            setSession(client.getSession());
            try {
                await getSessionData();
            } catch (profileErr) {
                // The session is valid (verify passed) but the profile fetch
                // failed transiently — surface it, do NOT log out.
                setError(profileErr as AuthError);
            }
            return true;
        }

        // Indeterminate: re-throw so manual callers can show a retry. (The mount
        // effect swallows this.)
        if (outcome.type === 'indeterminate') {
            throw outcome.error;
        }
        return false;
    }, [client, getSessionData]);

    const verify2fa = useCallback(async (dto: IVerify2faRequest) => {
        setError(null);
        try {
            const response = await client.verify2fa(dto);
            await getSessionData();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, getSessionData]);

    const switchTenant = useCallback(async (dto: ISwitchTenantRequest) => {
        setError(null);
        try {
            const response = await client.switchTenant(dto);
            await getSessionData();
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, getSessionData]);

    const passwordlessSend = useCallback(async (dto: IPasswordlessSendRequest) => {
        setError(null);
        try {
            return await client.passwordlessSend(dto);
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const passwordlessLogin = useCallback(async (dto: IPasswordlessLoginRequest) => {
        setError(null);
        try {
            const response = await client.passwordlessLogin(dto);
            if (!response.isRequiresMfa) {
                await getSessionData();
            }
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client, getSessionData]);

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
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);


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
            const response = await client.verifyPhone(dto);
            return response;
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
    const setupTotp = useCallback(async (body?: ISetupTotpRequest) => {
        setError(null);
        try {
            return await client.setupTotp(body);
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
        setSession(prev => prev ? { ...prev, tenantId: id } : prev);
    }, [client]);

    const getTenantId = useCallback(() => {
        return client.getTenantId();
    }, [client]);

    // Memoize context value
    const contextValue: AuthContextValue = useMemo(() => ({
        status,
        sessionData,
        session,
        error,
        isLoading: status === 'loading' || sessionDataLoading,
        isLoadingSessionData: sessionDataLoading,
        isAuthenticated: status === 'authenticated',
        client,
        // Core auth
        getSessionData,
        login,
        signup,
        logout,
        logoutAll,
        refresh,
        verifySession,
        verify2fa,
        switchTenant,
        passwordlessSend,
        passwordlessLogin,
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
        sessionData,
        session,
        error,
        client,
        sessionDataLoading,
        getSessionData,
        login,
        signup,
        logout,
        logoutAll,
        refresh,
        verifySession,
        verify2fa,
        switchTenant,
        passwordlessSend,
        passwordlessLogin,
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
