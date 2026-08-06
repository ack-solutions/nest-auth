"use client";

/**
 * useAuthStatus hook - Auth status only
 */

import { useContext } from 'react';
import { AuthStatus } from '@ackplus/nest-auth-client';
import { AuthContext } from '../context/auth-context';

/**
 * Auth status with derived booleans
 */
export interface AuthStatusResult {
    /** Current auth status */
    status: AuthStatus;
    /** Whether auth is loading */
    isLoading: boolean;
    /** Whether user is authenticated */
    isAuthenticated: boolean;
    /** Whether user is unauthenticated */
    isUnauthenticated: boolean;
    /**
     * Whether the session state is UNKNOWN — a session check could not be
     * completed (server unreachable). This is NOT logged-out: never redirect to
     * login on `isUnknown`. Guards treat it like "still resolving".
     */
    isUnknown: boolean;
}

/**
 * Access auth status with derived booleans
 * 
 * @returns Auth status object
 * 
 * @example
 * ```tsx
 * function ConditionalContent() {
 *   const { isLoading, isAuthenticated } = useAuthStatus();
 * 
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <LoginPrompt />;
 * 
 *   return <ProtectedContent />;
 * }
 * ```
 */
export function useAuthStatus(): AuthStatusResult {
    const context = useContext(AuthContext);

    return {
        status: context.status,
        isLoading: context.status === 'loading' || context.isLoadingSessionData,
        isAuthenticated: context.status === 'authenticated',
        isUnauthenticated: context.status === 'unauthenticated',
        isUnknown: context.status === 'unknown',
    };
}
