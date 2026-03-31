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
    IPasswordlessOtpLoginCredentials,
    ILoginCredentials,
    ILoginRequest,
    ISignupRequest,
    IRefreshRequest,
    ISwitchTenantRequest,
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
    IVerifyPhoneRequest,
    IResendVerificationRequest,
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    ISessionVerifyResponse,
} from './verification';
// Passwordless login
export {
    NEST_AUTH_PASSWORDLESS_PROVIDER,
} from './passwordless';
export type {
    PasswordlessChannel,
    IPasswordlessSendRequest,
} from './passwordless';

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
    TenantModeEnum,
    INestAuthTenantOptions,
} from './config';

// User & Role (from user.ts)
export {
    INestAuthUser,
} from './user';

// Role & Permission (from role.ts)
export {
    INestAuthRoleTenant,
    INestAuthRole,
    INestAuthPermission,
    ICreateRoleInput,
    IUpdateRoleInput,
    IUpdatePermissionInput,
    IRoleResponse,
} from './role';

// Tenant (from tenant.ts)
export {
    INestAuthTenant,
    INestAuthUserAccess,
} from './tenant';
