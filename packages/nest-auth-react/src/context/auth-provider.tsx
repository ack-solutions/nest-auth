/**
 * Auth provider component for React
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    AuthClient,
    IAuthUser,
    ClientSession,
    AuthError,
    AuthStatus,
    ILoginRequest,
    ISignupRequest,
    IVerify2faRequest,
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

        return () => {
            unsubscribeAuthState();
            unsubscribeError();
        };
    }, [client]);

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

    // Actions
    const login = useCallback(async (dto: ILoginRequest) => {
        setError(null);
        try {
            const response = await client.login(dto);
            if (!response.isRequiresMfa) {
                setUser(client.getUser());
                setSession(client.getSession());
                setStatus('authenticated');
            }
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const signup = useCallback(async (dto: ISignupRequest) => {
        setError(null);
        try {
            const response = await client.signup(dto);
            setUser(client.getUser());
            setSession(client.getSession());
            setStatus('authenticated');
            return response;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

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
            await client.verifySession();
            setUser(client.getUser());
            setSession(client.getSession());
            setStatus('authenticated');
            return true;
        } catch (err) {
            setError(err as AuthError);
            throw err;
        }
    }, [client]);

    const verify2fa = useCallback(async (dto: IVerify2faRequest) => {
        setError(null);
        try {
            const response = await client.verify2fa(dto);
            setUser(client.getUser());
            setSession(client.getSession());
            setStatus('authenticated');
            return response;
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
        login,
        signup,
        logout,
        refresh,
        verifySession,
        verify2fa,
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
        login,
        signup,
        logout,
        refresh,
        verifySession,
        verify2fa,
        setMode,
        getMode,
        setTenantId,
        getTenantId,
    ]);

    return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}
