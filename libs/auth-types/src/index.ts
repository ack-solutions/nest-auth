/**
 * @libs/auth-types - Shared authentication types
 */

// Auth types (from auth.ts)
export {
    MFAMethodEnum,
    OTPTypeEnum,
    type IEmailCredentials,
    type IPhoneCredentials,
    type ISocialCredentials,
    type ILoginCredentials,
    type ILoginRequest,
    type ISignupRequest,
    type IRefreshRequest,
    type ITokenPair,
    type IAuthResponse,
    type IAuthUser,
    type IAuthSession,
    type IMessageResponse,
    type IAuthCookieResponse,
    type IAuthSuccessResponse,
    type IUserResponse,
    type ITokensResponse,
    // Entities
    type INestAuthIdentity,
    type INestAuthSession,
    type INestAuthAccessKey,
    type INestAuthOTP,
} from './auth';

// MFA types (from mfa.ts)
export {
    type IVerify2faRequest,
    type IVerify2faResponse,
    type ISendMfaCodeRequest,
    type IToggleMfaRequest,
    type IVerifyTotpSetupRequest,
    type IMfaDevice,
    type IMfaStatusResponse,
    type IMfaCodeResponse,
    type ITotpSetupResponse,
    // Entities
    type INestAuthMFASecret,
    type INestAuthTrustedDevice,
} from './mfa';

// Password types
export {
    type IForgotPasswordRequest,
    type IResetPasswordRequest,
    type IResetPasswordWithTokenRequest,
    type IChangePasswordRequest,
    type IVerifyForgotPasswordOtpRequest,
    type IVerifyOtpResponse,
} from './password';

// Verification types
export {
    type IVerifyEmailRequest,
    type IResendVerificationRequest,
    type ISendEmailVerificationRequest,
    type ISessionVerifyResponse,
} from './verification';

// Admin types
export {
    type IInitializeAdminRequest,
    type IInitializeAdminResponse,
    type IAdminUser,
} from './admin';

// Config types
export {
    type IEmailAuthConfig,
    type IPhoneAuthConfig,
    type IProfileFieldOption,
    type IProfileField,
    type IRegistrationConfig,
    type IMfaConfig,
    type ITenantOption,
    type ITenantsConfig,
    type ISsoProviderConfig,
    type ISsoConfig,
    type IUiConfig,
    type IClientConfigResponse,
} from './config';

// User & Role types (from user.ts)
export {
    type INestAuthUser,
    type INestAuthRole,
    type INestAuthPermission,
} from './user';

// Tenant types (from tenant.ts)
export {
    type INestAuthTenant,
} from './tenant';

