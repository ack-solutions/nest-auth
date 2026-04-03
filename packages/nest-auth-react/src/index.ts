/**
 * @ackplus/nest-auth-react
 * 
 * React SDK for NestJS Auth
 * Provides hooks, components, and Next integration
 */

// Context & Provider
export { AuthContext, AuthContextValue } from './context/auth-context';
export { AuthProvider, AuthProviderProps, InitialAuthState } from './context/auth-provider';


// Hooks
export { useNestAuth } from './hooks/use-auth';
export { useUser } from './hooks/use-user';
export { useSession } from './hooks/use-session';
export { useAccessToken } from './hooks/use-access-token';
export { useAuthStatus, AuthStatusResult } from './hooks/use-auth-status';
export { useHasRole, useHasPermission } from './hooks/use-has-role';


// Guards
export { AuthGuard, AuthGuardProps } from './guards/auth-guard';
export { GuestGuard, GuestGuardProps } from './guards/guest-guard';
export { RequireRole, RequireRoleProps } from './guards/require-role';
export { RequirePermission, RequirePermissionProps } from './guards/require-permission';

// HOC Guards (for both React and Next.js)
export { 
    withRequireRole, 
    createRequireRoleHOC,
    WithRequireRoleOptions,
    WithRequireRoleInjectedProps,
} from './guards/with-require-role';
export { 
    withRequirePermission, 
    createRequirePermissionHOC,
    WithRequirePermissionOptions,
    WithRequirePermissionInjectedProps,
} from './guards/with-require-permission';


// Next helpers
export { createNextAuthHelpers, NextAuthHelpers, NextAuthHelpersConfig, ServerAuthState } from './next/create-next-auth-helpers';
export { NextAuthProvider, NextAuthProviderProps } from './next/next-auth-provider';


// Cross-tab sync
export { CrossTabSync, createCrossTabSync, SyncEvent, SyncEventType, SyncHandler } from './sync/cross-tab-sync';