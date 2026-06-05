/**
 * @ackplus/nest-auth-react-native
 *
 * React Native / Expo SDK for `@ackplus/nest-auth`. It adds native-friendly
 * token storage (AsyncStorage / Expo SecureStore) and a header-mode client
 * factory, and re-exports the React provider, hooks, and guards (which run
 * unchanged on RN — their web-only paths are feature-detected).
 *
 * Next.js helpers are intentionally NOT re-exported (web/server only).
 */

// --- React Native specifics --------------------------------------------------
export { AsyncStorageAdapter } from './storage/async-storage.adapter';
export type { AsyncStorageLike } from './storage/async-storage.adapter';
export { SecureStoreAdapter } from './storage/secure-store.adapter';
export type { SecureStoreLike } from './storage/secure-store.adapter';
export { createNestAuthClient } from './create-client';
export type { NestAuthRNConfig } from './create-client';
export { signInWithGoogle, signInWithApple } from './native-signin';
export type { GoogleSigninLike, AppleAuthLike } from './native-signin';

// --- Core client (framework-agnostic) ---------------------------------------
export {
    AuthClient,
    MemoryStorage,
    hasRole,
    hasPermission,
    hasAnyAccess,
    hasAllAccess,
} from '@ackplus/nest-auth-client';
export type {
    AuthClientConfig,
    StorageAdapter,
    AccessTokenType,
    EndpointConfig,
} from '@ackplus/nest-auth-client';

// --- Shared types + enums ----------------------------------------------------
export * from '@ackplus/nest-auth-contracts';

// --- React layer (provider, hooks, guards) — RN-compatible ------------------
export {
    AuthProvider,
    useNestAuth,
    useUser,
    useSession,
    useAccessToken,
    useAuthStatus,
    useHasRole,
    useHasPermission,
    useAuthHeaderFn,
    useAuthHeaderFnSync,
    AuthGuard,
    GuestGuard,
    RequireRole,
    RequirePermission,
} from '@ackplus/nest-auth-react';
export type {
    AuthContextValue,
    AuthProviderProps,
    AuthStatusResult,
} from '@ackplus/nest-auth-react';
