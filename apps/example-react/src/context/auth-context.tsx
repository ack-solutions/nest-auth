'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { ISessionUserData } from '@ackplus/nest-auth-client';
import {
    AuthProvider as NestAuthProvider,
    type AuthProviderProps,
    useNestAuth,
} from '@ackplus/nest-auth-react';
import { createAuthService } from '../services/auth.service';

type NestAuth = ReturnType<typeof useNestAuth>;

/**
 * Example app auth surface: everything from {@link useNestAuth} plus optional profile refresh helpers.
 */
export interface AppAuthContextValue extends NestAuth {
    /** False while the Nest auth client is still resolving the initial session. */
    isUserResolved: boolean;
    /** Re-fetch the current user from the API (`verifySession`). */
    refetchUser: () => Promise<ISessionUserData | null>;
}

const AppAuthContext = createContext<AppAuthContextValue | null>(null);

function AppAuthBridgeProvider({ children }: { children: ReactNode }) {
    const auth = useNestAuth();

    const authService = useMemo(() => createAuthService(auth.client), [auth.client]);

    const refetchUser = useCallback(async (): Promise<ISessionUserData | null> => {
        await authService.getCurrentUser();
        return auth.client.getUser();
    }, [auth.client, authService]);

    const value = useMemo<AppAuthContextValue>(
        () => ({
            ...auth,
            isUserResolved: auth.status !== 'loading',
            refetchUser,
        }),
        [auth, refetchUser],
    );

    return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export type AppAuthProviderProps = AuthProviderProps;

/**
 * Wraps `@ackplus/nest-auth-react` {@link AuthProvider} and exposes {@link useAuth} for the example app.
 */
export function AppAuthProvider({ children, ...nestProps }: AppAuthProviderProps) {
    return (
        <NestAuthProvider {...nestProps}>
            <AppAuthBridgeProvider>{children}</AppAuthBridgeProvider>
        </NestAuthProvider>
    );
}

/**
 * Full auth API for the example React app (Nest auth + `refetchUser`).
 */
export function useAuth(): AppAuthContextValue {
    const ctx = useContext(AppAuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AppAuthProvider');
    }
    return ctx;
}
