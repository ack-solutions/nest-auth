'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import {
    AuthProvider as NestAuthProvider,
    type AuthProviderProps,
    useNestAuth,
} from '@ackplus/nest-auth-react';
import { AppAuthContext, type AppAuthContextValue } from './auth-context';

function AppAuthBridgeProvider({ children }: { children: ReactNode }) {
    const auth = useNestAuth();

    const refetchUser = useCallback(() => {
        return auth.getSessionData().then(sessionData => sessionData);
    }, [auth]);

    const value = useMemo<AppAuthContextValue>(
        () => ({
            ...auth,
            isUserResolved: auth.status !== 'loading',
            refetchUser,
            user: auth.sessionData,
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
