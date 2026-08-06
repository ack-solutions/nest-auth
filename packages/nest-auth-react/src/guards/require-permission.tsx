"use client";

/**
 * RequirePermission component - Requires specific permission(s)
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { warnAuthStillLoading } from '../utils/dev-warn';
import { useHasPermission } from '../hooks/use-has-role';
import { decideAccessGuard } from './guard-decision';

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
    const { status, isLoading } = useAuthStatus();
    const hasRequiredPermission = useHasPermission(permission, matchAll);
    const { outcome, fireCallback } = decideAccessGuard({ status, isLoading }, hasRequiredPermission);

    useEffect(() => {
        // Deny ONLY on a definitive state. Never on `unknown` (session data
        // couldn't load): don't deny access during a server outage.
        if (fireCallback && onAccessDenied) {
            onAccessDenied();
        }
    }, [fireCallback, onAccessDenied]);

    // Loading, or UNKNOWN (couldn't determine access) — neutral loading state.
    if (outcome === 'loading') {
        if (isLoading && loadingFallback == null) warnAuthStillLoading();
        return React.createElement(React.Fragment, null, loadingFallback);
    }

    // Definitively denied: not authenticated, or missing the permission.
    if (outcome === 'deny') {
        return React.createElement(React.Fragment, null, onAccessDenied ? loadingFallback : fallback);
    }

    // Has permission - render children
    return React.createElement(React.Fragment, null, children);
}
