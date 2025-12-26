/**
 * RequireRole component - Requires specific role(s)
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { useHasRole } from '../hooks/use-has-role';


/**
 * Props for RequireRole component
 */
export interface RequireRoleProps {
    /** Content to render when role check passes */
    children: React.ReactNode;
    /** Required role or roles */
    role: string | string[];
    /** If true, user must have ALL roles */
    matchAll?: boolean;
    /** Content to render while loading */
    loadingFallback?: React.ReactNode;
    /** Content to render when access denied */
    fallback?: React.ReactNode;
    /** Callback when access is denied - use for navigation (react-router, next/router, etc.) */
    onAccessDenied?: () => void;
}

/**
 * Require specific role(s) to access content
 * 
 * @example
 * ```tsx
 * // Single role with React Router
 * const navigate = useNavigate();
 * <RequireRole role="admin" onAccessDenied={() => navigate('/unauthorized')}>
 *   <AdminPanel />
 * </RequireRole>
 * 
 * // Any of multiple roles
 * <RequireRole role={['admin', 'moderator']} fallback={<AccessDenied />}>
 *   <ModeratorTools />
 * </RequireRole>
 * 
 * // All roles required
 * <RequireRole role={['admin', 'verified']} matchAll>
 *   <SuperAdminPanel />
 * </RequireRole>
 * 
 * // With Next.js router
 * const router = useRouter();
 * <RequireRole role="admin" onAccessDenied={() => router.push('/unauthorized')}>
 *   <AdminPanel />
 * </RequireRole>
 * ```
 */
export function RequireRole({
    children,
    role,
    matchAll = false,
    loadingFallback = null,
    fallback = null,
    onAccessDenied,
}: RequireRoleProps): React.ReactElement | null {
    const { isLoading, isAuthenticated } = useAuthStatus();
    const hasRequiredRole = useHasRole(role, matchAll);
    const accessDenied = !isAuthenticated || !hasRequiredRole;

    useEffect(() => {
        if (!isLoading && accessDenied && onAccessDenied) {
            onAccessDenied();
        }
    }, [isLoading, accessDenied, onAccessDenied]);

    // Show loading state
    if (isLoading) {
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Not authenticated or doesn't have role
    if (accessDenied) {
        // If callback provided, show loading while redirecting
        if (onAccessDenied) {
            return React.createElement(React.Fragment, null, loadingFallback);
        }

        return React.createElement(React.Fragment, null, fallback);
    }

    // Has role - render children
    return React.createElement(React.Fragment, null, children);
}
