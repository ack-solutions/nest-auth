/**
 * GuestGuard component - Protects routes for unauthenticated users
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks';

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
}: GuestGuardProps): React.ReactElement | null {
    const { isLoading, isAuthenticated } = useAuthStatus();

    useEffect(() => {
        if (!isLoading && isAuthenticated && onAuthenticated) {
            onAuthenticated();
        }
    }, [isLoading, isAuthenticated, onAuthenticated]);

    // Show loading state
    if (isLoading) {
        return React.createElement(React.Fragment, null, loadingFallback);
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
