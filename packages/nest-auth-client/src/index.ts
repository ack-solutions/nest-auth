/**
 * @ackplus/nest-auth-client
 * 
 * Framework-agnostic authentication client for NestJS Auth
 * Works in Node.js, browsers, and React Native
 */

// Re-export shared types from @ackplus/nest-auth-contracts
export * from '@ackplus/nest-auth-contracts';

// Client-specific types
export {
    AuthStatus,
    AuthState,
    AuthError,
    DecodedJwt,
    ClientSession,
} from './types/auth.types';

// Config types
export {
    StorageAdapter,
    HttpAdapter,
    HttpRequestOptions,
    HttpResponse,
    Logger,
    EndpointConfig,
    AccessTokenType,
    AuthClientConfig,
    RequestOptions,
} from './types/config.types';

export { DEFAULT_ENDPOINTS } from './types/config.types';


// Storage adapters
export { MemoryStorage } from './storage/memory.storage';
export { LocalStorageAdapter } from './storage/local.storage';
export { SessionStorageAdapter } from './storage/session.storage';
export { CookieStorageAdapter, CookieOptions } from './storage/cookie.storage';

// HTTP adapters
export { FetchAdapter } from './http/fetch.adapter';
export { createAxiosAdapter } from './http/axios.adapter';

// Token utilities
export { decodeJwt, isTokenExpired, getTokenExpirationDate, getTokenTimeToExpiry, getUserIdFromToken } from './token/jwt-utils';
export { TokenManager, TokenManagerConfig } from './token/token-manager';

// Auth client
export { AuthClient } from './client/auth-client';
export { EventEmitter, createAuthEventEmitter } from './client/event-emitter';
export type { AuthEvents } from './client/event-emitter';
export { RefreshQueue, RetryTracker } from './client/refresh-queue';

// Utilities
export { hasRole, hasPermission, hasAnyAccess, hasAllAccess } from './utils/role-utils';
