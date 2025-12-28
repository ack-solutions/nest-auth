/**
 * withRequireRole HOC - Wraps a component with role-based access control
 * Works with both React and Next.js
 */

import React, { ComponentType, useEffect } from 'react';
import { useAuthStatus } from '../hooks/use-auth-status';
import { useHasRole } from '../hooks/use-has-role';

/**
 * Options for withRequireRole HOC
 */
export interface WithRequireRoleOptions {
    /** Required role or roles */
    role: string | string[];
    /** If true, user must have ALL roles */
    matchAll?: boolean;
    /** Component to render while loading */
    LoadingComponent?: ComponentType;
    /** Component to render when access denied */
    FallbackComponent?: ComponentType;
    /** Callback when access is denied - use for navigation */
    onAccessDenied?: () => void;
}

/**
 * Props injected by withRequireRole HOC
 */
export interface WithRequireRoleInjectedProps {
    /** Whether the user has the required role(s) */
    hasRole: boolean;
    /** Whether the auth check is loading */
    isLoading: boolean;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
}

/**
 * HOC that wraps a component with role-based access control
 * Works with both React and Next.js
 * 
 * @example
 * ```tsx
 * // Basic usage - React
 * const ProtectedAdminPanel = withRequireRole(AdminPanel, {
 *   role: 'admin',
 *   FallbackComponent: AccessDenied,
 * });
 * 
 * // Multiple roles (any) - React Router
 * const navigate = useNavigate();
 * const ProtectedModTools = withRequireRole(ModeratorTools, {
 *   role: ['admin', 'moderator'],
 *   onAccessDenied: () => navigate('/unauthorized'),
 * });
 * 
 * // All roles required
 * const ProtectedSuperAdmin = withRequireRole(SuperAdminPanel, {
 *   role: ['admin', 'verified'],
 *   matchAll: true,
 * });
 * 
 * // Next.js App Router
 * const ProtectedPage = withRequireRole(DashboardPage, {
 *   role: 'admin',
 *   onAccessDenied: () => {
 *     // Use next/navigation
 *     redirect('/unauthorized');
 *   },
 * });
 * 
 * // Next.js Pages Router
 * const router = useRouter();
 * const ProtectedPage = withRequireRole(DashboardPage, {
 *   role: 'admin',
 *   onAccessDenied: () => router.push('/unauthorized'),
 * });
 * ```
 */
export function withRequireRole<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: WithRequireRoleOptions
): ComponentType<Omit<P, keyof WithRequireRoleInjectedProps>> {
    const {
        role,
        matchAll = false,
        LoadingComponent,
        FallbackComponent,
        onAccessDenied,
    } = options;

    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

    function WithRequireRoleWrapper(props: Omit<P, keyof WithRequireRoleInjectedProps>): React.ReactElement | null {
        const { isLoading, isAuthenticated } = useAuthStatus();
        const hasRequiredRole = useHasRole(role, matchAll);
        const accessDenied = !isAuthenticated || !hasRequiredRole;

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

        // Not authenticated or doesn't have role
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

        // Has role - render wrapped component with injected props
        const injectedProps: WithRequireRoleInjectedProps = {
            hasRole: hasRequiredRole,
            isLoading,
            isAuthenticated,
        };

        return React.createElement(
            WrappedComponent,
            { ...props, ...injectedProps } as P
        );
    }

    WithRequireRoleWrapper.displayName = `WithRequireRole(${displayName})`;

    return WithRequireRoleWrapper;
}

/**
 * Factory function to create a configured withRequireRole HOC
 * Useful for creating reusable HOCs with preset options
 * 
 * @example
 * ```tsx
 * // Create a reusable admin-only HOC
 * const withAdminOnly = createRequireRoleHOC({
 *   role: 'admin',
 *   LoadingComponent: LoadingSpinner,
 *   FallbackComponent: AccessDenied,
 * });
 * 
 * // Use it to wrap components
 * const ProtectedAdminPanel = withAdminOnly(AdminPanel);
 * const ProtectedSettings = withAdminOnly(SettingsPage);
 * ```
 */
export function createRequireRoleHOC(defaultOptions: Partial<WithRequireRoleOptions>) {
    return function<P extends object>(
        WrappedComponent: ComponentType<P>,
        overrideOptions?: Partial<WithRequireRoleOptions>
    ): ComponentType<Omit<P, keyof WithRequireRoleInjectedProps>> {
        const mergedOptions = {
            ...defaultOptions,
            ...overrideOptions,
        } as WithRequireRoleOptions;

        if (!mergedOptions.role) {
            throw new Error('withRequireRole: role option is required');
        }

        return withRequireRole(WrappedComponent, mergedOptions);
    };
}
