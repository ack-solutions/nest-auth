/**
 * AuthGuard component - Protects routes for authenticated users
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks';

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
    const { isLoading, isAuthenticated } = useAuthStatus();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && onUnauthenticated) {
            onUnauthenticated();
        }
    }, [isLoading, isAuthenticated, onUnauthenticated]);

    // Show loading state
    if (isLoading) {
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Not authenticated
    if (!isAuthenticated) {
        // If callback provided, show loading while redirecting
        if (onUnauthenticated) {
            return React.createElement(React.Fragment, null, loadingFallback);
        }

        // Show fallback
        return React.createElement(React.Fragment, null, fallback);
    }

    // Authenticated - render children
    return React.createElement(React.Fragment, null, children);
}
