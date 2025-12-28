/**
 * withRequirePermission HOC - Wraps a component with permission-based access control
 * Works with both React and Next.js
 */

import React, { ComponentType, useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { useHasPermission } from '../hooks/use-has-role';

/**
 * Options for withRequirePermission HOC
 */
export interface WithRequirePermissionOptions {
    /** Required permission or permissions */
    permission: string | string[];
    /** If true, user must have ALL permissions */
    matchAll?: boolean;
    /** Component to render while loading */
    LoadingComponent?: ComponentType;
    /** Component to render when access denied */
    FallbackComponent?: ComponentType;
    /** Callback when access is denied - use for navigation */
    onAccessDenied?: () => void;
}

/**
 * Props injected by withRequirePermission HOC
 */
export interface WithRequirePermissionInjectedProps {
    /** Whether the user has the required permission(s) */
    hasPermission: boolean;
    /** Whether the auth check is loading */
    isLoading: boolean;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
}

/**
 * HOC that wraps a component with permission-based access control
 * Works with both React and Next.js
 * 
 * @example
 * ```tsx
 * // Basic usage - React
 * const ProtectedOrdersList = withRequirePermission(OrdersList, {
 *   permission: 'orders.read',
 *   FallbackComponent: AccessDenied,
 * });
 * 
 * // Multiple permissions (any) - React Router
 * const navigate = useNavigate();
 * const ProtectedOrdersPage = withRequirePermission(OrdersPage, {
 *   permission: ['orders.read', 'orders.write'],
 *   onAccessDenied: () => navigate('/unauthorized'),
 * });
 * 
 * // All permissions required
 * const ProtectedOrderManagement = withRequirePermission(OrderManagement, {
 *   permission: ['orders.read', 'orders.delete'],
 *   matchAll: true,
 * });
 * 
 * // Next.js App Router
 * const ProtectedPage = withRequirePermission(AdminSection, {
 *   permission: 'admin.access',
 *   onAccessDenied: () => {
 *     // Use next/navigation
 *     redirect('/unauthorized');
 *   },
 * });
 * 
 * // Next.js Pages Router
 * const router = useRouter();
 * const ProtectedPage = withRequirePermission(AdminSection, {
 *   permission: 'admin.access',
 *   onAccessDenied: () => router.push('/unauthorized'),
 * });
 * ```
 */
export function withRequirePermission<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: WithRequirePermissionOptions
): ComponentType<Omit<P, keyof WithRequirePermissionInjectedProps>> {
    const {
        permission,
        matchAll = false,
        LoadingComponent,
        FallbackComponent,
        onAccessDenied,
    } = options;

    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

    function WithRequirePermissionWrapper(props: Omit<P, keyof WithRequirePermissionInjectedProps>): React.ReactElement | null {
        const { isLoading, isAuthenticated } = useAuthStatus();
        const hasRequiredPermission = useHasPermission(permission, matchAll);
        const accessDenied = !isAuthenticated || !hasRequiredPermission;

        useEffect(() => {
            if (!isLoading && accessDenied && onAccessDenied) {
                onAccessDenied();
            }
        }, [isLoading, accessDenied]);

        // Show loading state
        if (isLoading) {
            if (LoadingComponent) {
                return React.createElement(LoadingComponent);
            }
            return null;
        }

        // Not authenticated or doesn't have permission
        if (accessDenied) {
            // If callback provided, show loading while redirecting
            if (onAccessDenied) {
                if (LoadingComponent) {
                    return React.createElement(LoadingComponent);
                }
                return null;
            }

            if (FallbackComponent) {
                return React.createElement(FallbackComponent);
            }
            return null;
        }

        // Has permission - render wrapped component with injected props
        const injectedProps: WithRequirePermissionInjectedProps = {
            hasPermission: hasRequiredPermission,
            isLoading,
            isAuthenticated,
        };

        return React.createElement(
            WrappedComponent,
            { ...props, ...injectedProps } as P
        );
    }

    WithRequirePermissionWrapper.displayName = `WithRequirePermission(${displayName})`;

    return WithRequirePermissionWrapper;
}

/**
 * Factory function to create a configured withRequirePermission HOC
 * Useful for creating reusable HOCs with preset options
 * 
 * @example
 * ```tsx
 * // Create a reusable orders-read-only HOC
 * const withOrdersReadAccess = createRequirePermissionHOC({
 *   permission: 'orders.read',
 *   LoadingComponent: LoadingSpinner,
 *   FallbackComponent: AccessDenied,
 * });
 * 
 * // Use it to wrap components
 * const ProtectedOrdersList = withOrdersReadAccess(OrdersList);
 * const ProtectedOrderDetails = withOrdersReadAccess(OrderDetails);
 * 
 * // Create an admin-only HOC
 * const withAdminAccess = createRequirePermissionHOC({
 *   permission: 'admin.access',
 *   LoadingComponent: () => <div>Loading...</div>,
 * });
 * ```
 */
export function createRequirePermissionHOC(defaultOptions: Partial<WithRequirePermissionOptions>) {
    return function<P extends object>(
        WrappedComponent: ComponentType<P>,
        overrideOptions?: Partial<WithRequirePermissionOptions>
    ): ComponentType<Omit<P, keyof WithRequirePermissionInjectedProps>> {
        const mergedOptions = {
            ...defaultOptions,
            ...overrideOptions,
        } as WithRequirePermissionOptions;

        if (!mergedOptions.permission) {
            throw new Error('withRequirePermission: permission option is required');
        }

        return withRequirePermission(WrappedComponent, mergedOptions);
    };
}
