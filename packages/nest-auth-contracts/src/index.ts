/**
 * @libs/auth-s - Shared authentication s
 */

// Auth s (from auth.ts)
export {
    NestAuthMFAMethodEnum,
    NestAuthOTPTypeEnum,
    IEmailCredentials,
    IPhoneCredentials,
    ISocialCredentials,
    ILoginCredentials,
    ILoginRequest,
    ISignupRequest,
    IRefreshRequest,
    ITokenPair,
    IAuthResponse,
    IAuthUser,
    IAuthSession,
    IMessageResponse,
    IAuthCookieResponse,
    IAuthSuccessResponse,
    IUserResponse,
    ITokensResponse,
    // Entities
    INestAuthIdentity,
    INestAuthSession,
    INestAuthAccessKey,
    INestAuthOTP,
} from './auth';

// MFA (from mfa.ts)
export {
    IVerify2faRequest,
    IVerify2faResponse,
    ISendMfaCodeRequest,
    IToggleMfaRequest,
    IVerifyTotpSetupRequest,
    IMfaDevice,
    IMfaStatusResponse,
    IMfaCodeResponse,
    ITotpSetupResponse,
    // Entities
    INestAuthMFASecret,
    INestAuthTrustedDevice,
} from './mfa';

// Password
export {
    IForgotPasswordRequest,
    IResetPasswordWithTokenRequest,
    IChangePasswordRequest,
    IVerifyForgotPasswordOtpRequest,
    IVerifyOtpResponse,
} from './password';

// Verification
export {
    IVerifyEmailRequest,
    IResendVerificationRequest,
    ISendEmailVerificationRequest,
    ISessionVerifyResponse,
} from './verification';

// Admin
export {
    IInitializeAdminRequest,
    IInitializeAdminResponse,
    IAdminUser,
} from './admin';

// Config
export {
    IEmailAuthConfig,
    IPhoneAuthConfig,
    IProfileFieldOption,
    IProfileField,
    IRegistrationConfig,
    IMfaConfig,
    ITenantOption,
    ITenantsConfig,
    ISsoProviderConfig,
    ISsoConfig,
    IUiConfig,
    IClientConfigResponse,
} from './config';

// User & Role (from user.ts)
export {
    INestAuthUser,
    INestAuthRole,
    INestAuthPermission,
} from './user';

// Tenant (from tenant.ts)
export {
    INestAuthTenant,
} from './tenant';

