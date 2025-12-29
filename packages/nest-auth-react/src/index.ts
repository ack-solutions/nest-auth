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

// Re-export commonly used types from client
export type {
    IAuthUser as AuthUser,
    ClientSession as AuthSession,
    AuthStatus,
    AuthState,
    AuthError,
    ITokenPair as TokenPair,
    ILoginRequest as LoginDto,
    ISignupRequest as SignupDto,
    IAuthResponse as AuthResponse,
    AuthClientConfig,
    // Password management DTOs
    IForgotPasswordRequest as ForgotPasswordDto,
    IResetPasswordWithTokenRequest as ResetPasswordDto,
    IChangePasswordRequest as ChangePasswordDto,
    // Email verification DTOs
    IVerifyEmailRequest as VerifyEmailDto,
    IResendVerificationRequest as ResendVerificationDto,
    // 2FA DTOs
    IVerify2faRequest as Verify2faDto,
    IVerify2faResponse as Verify2faResponse,
    // Response types
    IMessageResponse as MessageResponse,
    IVerifyOtpResponse as VerifyOtpResponse,
} from '@ackplus/nest-auth-client';

// Re-export client class for convenience
export { AuthClient } from '@ackplus/nest-auth-client';

// Re-export utility functions
export { hasRole, hasPermission, hasAnyAccess, hasAllAccess } from '@ackplus/nest-auth-client';
