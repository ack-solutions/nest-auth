/**
 * Types barrel export
 */

// Core types (client-specific)
export type {
    AuthStatus,
    AuthState,
    AuthError,
    DecodedJwt,
    ClientSession,
} from './auth.types';

// Config types
export type {
    StorageAdapter,
    HttpAdapter,
    HttpRequestOptions,
    HttpResponse,
    Logger,
    EndpointConfig,
    AccessTokenType,
    AuthClientConfig,
    RequestOptions,
} from './config.types';

export { DEFAULT_ENDPOINTS } from './config.types';
