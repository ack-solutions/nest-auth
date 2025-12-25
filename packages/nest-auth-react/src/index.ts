/**
 * @ackplus/nest-auth-react
 * 
 * React SDK for NestJS Auth
 * Provides hooks, components, and Next.js integration
 */

// Context & Provider
export * from './context';

// Hooks
export * from './hooks';

// Guards
export * from './guards';

// Next.js helpers
export * from './next';

// Cross-tab sync
export * from './sync';

// Re-export commonly used types from client
export type {
    AuthUser,
    AuthSession,
    AuthStatus,
    AuthState,
    AuthError,
    TokenPair,
    LoginDto,
    SignupDto,
    AuthResponse,
    AuthClientConfig,
} from '@ackplus/nest-auth-client';

// Re-export client class for convenience
export { AuthClient } from '@ackplus/nest-auth-client';

// Re-export utility functions
export { hasRole, hasPermission, hasAnyAccess, hasAllAccess } from '@ackplus/nest-auth-client';
