/**
 * Types barrel export
 */

// Core types
export type {
    AuthUser,
    AuthSession,
    AuthStatus,
    AuthState,
    AuthError,
    TokenPair,
    DecodedJwt,
} from './auth.types';

// DTOs
export type {
    // Credentials
    EmailCredentials,
    PhoneCredentials,
    SocialCredentials,
    LoginCredentials,
    // Request DTOs
    LoginDto,
    SignupDto,
    RefreshDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    VerifyEmailDto,
    ResendVerificationDto,
    ChangePasswordDto,
    Verify2faDto,
    // Response DTOs
    AuthResponse,
    MeResponse,
    MessageResponse,
    VerifyOtpResponse,
    Verify2faResponse,
    SessionVerifyResponse,
} from './dto.types';

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
