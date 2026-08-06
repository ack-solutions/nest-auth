"use client";

/**
 * RequireRole component - Requires specific role(s)
 */

import React, { useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { warnAuthStillLoading } from '../utils/dev-warn';
import { useHasRole } from '../hooks/use-has-role';
import { decideAccessGuard } from './guard-decision';


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
    const { status, isLoading } = useAuthStatus();
    const hasRequiredRole = useHasRole(role, matchAll);
    const { outcome, fireCallback } = decideAccessGuard({ status, isLoading }, hasRequiredRole);

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

    // Definitively denied: not authenticated, or missing the role.
    if (outcome === 'deny') {
        return React.createElement(React.Fragment, null, onAccessDenied ? loadingFallback : fallback);
    }

    // Has role - render children
    return React.createElement(React.Fragment, null, children);
}
