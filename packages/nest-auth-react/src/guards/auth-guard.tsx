"use client";

/**
 * AuthGuard component - Protects routes for authenticated users
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { warnAuthStillLoading } from '../utils/dev-warn';
import { decideAuthGuard } from './guard-decision';

/**
 * Props for AuthGuard component
 */
export interface AuthGuardProps {
    /** Content to render when authenticated */
    children: React.ReactNode;
    /** Content to render while loading */
    loadingFallback?: React.ReactNode;
    /** Content to render when unauthenticated (if no onUnauthenticated) */
    fallback?: React.ReactNode;
    /** Callback when user is unauthenticated - use for navigation (react-router, next/router, etc.) */
    onUnauthenticated?: () => void;
}

/**
 * Protect routes that require authentication
 * 
 * @example
 * ```tsx
 * // With fallback
 * <AuthGuard fallback={<LoginPage />}>
 *   <ProtectedContent />
 * </AuthGuard>
 * 
 * // With React Router navigation
 * const navigate = useNavigate();
 * <AuthGuard onUnauthenticated={() => navigate('/login')}>
 *   <Dashboard />
 * </AuthGuard>
 * 
 * // With Next.js router
 * const router = useRouter();
 * <AuthGuard onUnauthenticated={() => router.push('/login')}>
 *   <Dashboard />
 * </AuthGuard>
 * 
 * // With loading state
 * <AuthGuard
 *   loadingFallback={<Spinner />}
 *   fallback={<LoginPage />}
 * >
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
    children,
    loadingFallback = null,
    fallback = null,
    onUnauthenticated,
}: AuthGuardProps): React.ReactElement | null {
    const { status, isLoading } = useAuthStatus();
    const { outcome, fireCallback } = decideAuthGuard({ status, isLoading });

    useEffect(() => {
        // Redirect ONLY on a definitive `unauthenticated`. Never on `unknown` (a
        // session check we couldn't complete): a server outage must not bounce a
        // user with a valid session to login.
        if (fireCallback && onUnauthenticated) {
            onUnauthenticated();
        }
    }, [fireCallback, onUnauthenticated]);

    // Loading, or UNKNOWN (couldn't determine) — render the neutral loading state.
    if (outcome === 'loading') {
        if (isLoading && loadingFallback == null) warnAuthStillLoading();
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Definitively unauthenticated.
    if (outcome === 'deny') {
        // If callback provided, show loading while redirecting.
        return React.createElement(React.Fragment, null, onUnauthenticated ? loadingFallback : fallback);
    }

    // Authenticated - render children
    return React.createElement(React.Fragment, null, children);
}
