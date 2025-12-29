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
        isLoading: context.status === 'loading',
        isAuthenticated: context.status === 'authenticated' && context.user !== null,
        isUnauthenticated: context.status === 'unauthenticated',
    };
}
