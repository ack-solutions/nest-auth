/**
 * NextAuthProvider for Next.js apps
 */

import React from 'react';
import { AuthClient, AuthUser, AuthSession } from '@ackplus/nest-auth-client';
import { AuthProvider, AuthProviderProps } from '../context';

/**
 * Props for NextAuthProvider
 */
export interface NextAuthProviderProps extends Omit<AuthProviderProps, 'initialState'> {
    /** Initial auth state from server */
    initialState?: {
        user?: AuthUser | null;
        session?: AuthSession | null;
    };
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
 *   initialState?: { user?: AuthUser | null; session?: AuthSession | null };
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
    autoLoadMe = true,
    onUnauthenticated,
    children,
}: NextAuthProviderProps) {
    // If we have initial state from server, don't auto-load
    const shouldAutoLoad = autoLoadMe && !initialState?.user;

    return React.createElement(AuthProvider, {
        client,
        initialState: initialState ? {
            user: initialState.user ?? null,
            session: initialState.session ?? null,
            status: initialState.user ? 'authenticated' : 'unauthenticated',
        } : undefined,
        autoLoadMe: shouldAutoLoad,
        onUnauthenticated,
        children,
    });
}
