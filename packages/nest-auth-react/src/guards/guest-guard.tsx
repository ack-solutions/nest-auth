"use client";

/**
 * GuestGuard component - Protects routes for unauthenticated users
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { warnAuthStillLoading } from '../utils/dev-warn';

/**
 * Props for GuestGuard component
 */
export interface GuestGuardProps {
    /** Content to render when unauthenticated (guest) */
    children: React.ReactNode;
    /** Content to render while loading */
    loadingFallback?: React.ReactNode;
    /** Content to render when authenticated */
    fallback?: React.ReactNode;
    /** Callback when user is authenticated - use for navigation (react-router, next/router, etc.) */
    onAuthenticated?: () => void;
    /**
     * When `true`, render `children` even if the user is already authenticated.
     * Use it for a multi-account app that must show the login form to ADD another
     * account (Gmail-style) — drive it from your own signal, e.g. a `?add=1` query
     * param. The `onAuthenticated` redirect and `fallback` are skipped while set.
     * See {@link AddAccountGuard} for a ready-made wrapper.
     */
    allowWhenAddingAccount?: boolean;
}

/**
 * Protect routes that should only be accessible to guests (unauthenticated users)
 * 
 * @example
 * ```tsx
 * // With React Router navigation
 * const navigate = useNavigate();
 * <GuestGuard onAuthenticated={() => navigate('/dashboard')}>
 *   <LoginPage />
 * </GuestGuard>
 * 
 * // With Next.js router
 * const router = useRouter();
 * <GuestGuard onAuthenticated={() => router.push('/dashboard')}>
 *   <LoginPage />
 * </GuestGuard>
 * 
 * // With fallback
 * <GuestGuard fallback={<div>Already logged in</div>}>
 *   <RegisterPage />
 * </GuestGuard>
 * ```
 */
export function GuestGuard({
    children,
    loadingFallback = null,
    fallback = null,
    onAuthenticated,
    allowWhenAddingAccount = false,
}: GuestGuardProps): React.ReactElement | null {
    const { isLoading, isAuthenticated } = useAuthStatus();

    useEffect(() => {
        if (!isLoading && isAuthenticated && onAuthenticated && !allowWhenAddingAccount) {
            onAuthenticated();
        }
    }, [isLoading, isAuthenticated, onAuthenticated, allowWhenAddingAccount]);

    // Show loading state
    if (isLoading) {
        if (loadingFallback == null) warnAuthStillLoading();
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Adding-an-account mode: render the login form even though authenticated.
    if (allowWhenAddingAccount) {
        return React.createElement(React.Fragment, null, children);
    }

    // Authenticated - redirect or show fallback
    if (isAuthenticated) {
        // If callback provided, show loading while redirecting
        if (onAuthenticated) {
            return React.createElement(React.Fragment, null, loadingFallback);
        }

        return React.createElement(React.Fragment, null, fallback);
    }

    // Guest - render children
    return React.createElement(React.Fragment, null, children);
}
