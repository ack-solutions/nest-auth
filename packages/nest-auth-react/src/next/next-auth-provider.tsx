/**
 * NextAuthProvider for Next.js apps
 */

import React from 'react';
import { ISessionUserData, ClientSession, AuthStatus } from '@ackplus/nest-auth-client';
import { AuthProvider, AuthProviderProps } from '../context/auth-provider';

/**
 * Props for NextAuthProvider
 */
export interface NextAuthProviderProps extends Omit<AuthProviderProps, 'initialState'> {
    /** Initial auth state from server (the return of `createInitialState`). */
    initialState?: {
        user?: ISessionUserData | null;
        session?: ClientSession | null;
        /**
         * Set by `getServerAuth`/`createInitialState` when the SSR session check
         * could NOT be completed (backend 5xx / timeout / network). Hydrate this
         * as `'unknown'`, NOT `'unauthenticated'`.
         */
        indeterminate?: boolean;
    };
}

/**
 * Resolve the hydration status from the server auth state — the ONE place that
 * decides how an SSR result seeds the client.
 *
 * A missing user is only DEFINITIVELY `'unauthenticated'` when the server was
 * actually reached. If the SSR check was `indeterminate` (a backend outage), we
 * must hydrate as `'unknown'` so the guards don't redirect to login and the
 * client-side `verifySession()` can resolve it once the backend is reachable —
 * hydrating `'unauthenticated'` there both flashes the login page AND sticks
 * (the client re-verify keeps the prior status on an indeterminate outcome).
 */
export function resolveInitialStatus(
    initialState?: { user?: ISessionUserData | null; indeterminate?: boolean },
): AuthStatus {
    if (!initialState) return 'loading';
    if (initialState.user) return 'authenticated';
    return initialState.indeterminate ? 'unknown' : 'unauthenticated';
}

/**
 * Auth provider optimized for Next.js
 * 
 * Automatically handles SSR hydration and avoids unnecessary re-fetches
 * when initial state is provided from the server.
 * 
 * @example
 * ```tsx
 * // app/providers.tsx
 * 'use client';
 * 
 * import { NextAuthProvider } from '@ackplus/nest-auth-react';
 * import { authClient } from '@/lib/auth-client';
 * 
 * export function Providers({ 
 *   children, 
 *   initialState 
 * }: { 
 *   children: React.ReactNode;
 *   initialState?: { user?: ISessionUserData | null; session?: ClientSession | null };
 * }) {
 *   return (
 *     <NextAuthProvider client={authClient} initialState={initialState}>
 *       {children}
 *     </NextAuthProvider>
 *   );
 * }
 * ```
 */
export function NextAuthProvider({
    client,
    initialState,
    onUnauthenticated,
    children,
}: NextAuthProviderProps) {
    return React.createElement(AuthProvider, {
        client,
        initialState: initialState ? {
            session: initialState.session ?? null,
            // 'unknown' (not 'unauthenticated') when the SSR check was an outage,
            // so a valid session isn't bounced to login during a backend blip.
            status: resolveInitialStatus(initialState),
        } : undefined,
        onUnauthenticated,
        children,
    });
}
