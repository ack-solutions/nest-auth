/**
 * RequirePermission component - Requires specific permission(s)
 */

import React, { useEffect } from 'react';
import { useAuthStatus, useHasPermission } from '../hooks';

/**
 * Props for RequirePermission component
 */
export interface RequirePermissionProps {
    /** Content to render when permission check passes */
    children: React.ReactNode;
    /** Required permission or permissions */
    permission: string | string[];
    /** If true, user must have ALL permissions */
    matchAll?: boolean;
    /** Content to render while loading */
    loadingFallback?: React.ReactNode;
    /** Content to render when access denied */
    fallback?: React.ReactNode;
    /** Callback when access is denied - use for navigation (react-router, next/router, etc.) */
    onAccessDenied?: () => void;
}

/**
 * Require specific permission(s) to access content
 * 
 * @example
 * ```tsx
 * // Single permission with React Router
 * const navigate = useNavigate();
 * <RequirePermission permission="orders.read" onAccessDenied={() => navigate('/unauthorized')}>
 *   <OrdersList />
 * </RequirePermission>
 * 
 * // Any of multiple permissions
 * <RequirePermission permission={['orders.read', 'orders.write']} fallback={<AccessDenied />}>
 *   <OrdersPage />
 * </RequirePermission>
 * 
 * // All permissions required
 * <RequirePermission permission={['orders.read', 'orders.delete']} matchAll>
 *   <OrderManagement />
 * </RequirePermission>
 * 
 * // With Next.js router
 * const router = useRouter();
 * <RequirePermission permission="admin.access" onAccessDenied={() => router.push('/unauthorized')}>
 *   <AdminSection />
 * </RequirePermission>
 * ```
 */
export function RequirePermission({
    children,
    permission,
    matchAll = false,
    loadingFallback = null,
    fallback = null,
    onAccessDenied,
}: RequirePermissionProps): React.ReactElement | null {
    const { isLoading, isAuthenticated } = useAuthStatus();
    const hasRequiredPermission = useHasPermission(permission, matchAll);
    const accessDenied = !isAuthenticated || !hasRequiredPermission;

    useEffect(() => {
        if (!isLoading && accessDenied && onAccessDenied) {
            onAccessDenied();
        }
    }, [isLoading, accessDenied, onAccessDenied]);

    // Show loading state
    if (isLoading) {
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Not authenticated or doesn't have permission
    if (accessDenied) {
        // If callback provided, show loading while redirecting
        if (onAccessDenied) {
            return React.createElement(React.Fragment, null, loadingFallback);
        }

        return React.createElement(React.Fragment, null, fallback);
    }

    // Has permission - render children
    return React.createElement(React.Fragment, null, children);
}
