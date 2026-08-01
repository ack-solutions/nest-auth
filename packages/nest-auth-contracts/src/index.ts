/**
 * @ackplus/nest-auth-contracts — shared types + a few runtime enums.
 *
 * Note: `export {}` is used for RUNTIME values (enums + token constants).
 *       `export type {}` is used for INTERFACES + TYPE ALIASES.
 * Mixing them causes "No matching export" errors under newer esbuild (≥0.27).
 */

// Runtime values from auth.ts (enums only)
export { NestAuthMFAMethodEnum, NestAuthOTPTypeEnum } from './auth';

// Type-only re-exports from auth.ts
export type {
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
    ISessionUserData,
    IAuthSession,
    IMessageResponse,
    IAuthCookieResponse,
    IAuthSuccessResponse,
    IUserResponse,
    ITokensResponse,
    INestAuthIdentity,
    INestAuthSession,
    INestAuthAccessKey,
    INestAuthOTP,
} from './auth';

// MFA (from mfa.ts) — all types
export type {
    IVerify2faRequest,
    IVerify2faResponse,
    ISendMfaCodeRequest,
    IToggleMfaRequest,
    IVerifyTotpSetupRequest,
    IMfaDevice,
    IMfaStatusResponse,
    IMfaCodeResponse,
    ITotpSetupResponse,
    INestAuthMFASecret,
    INestAuthTrustedDevice,
} from './mfa';

// Password — all types
export type {
    IForgotPasswordRequest,
    IResetPasswordWithTokenRequest,
    IChangePasswordRequest,
    IVerifyForgotPasswordOtpRequest,
    IVerifyOtpResponse,
} from './password';

// Verification — all types
export type {
    IVerifyEmailRequest,
    IVerifyPhoneRequest,
    IResendVerificationRequest,
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    ISessionVerifyResponse,
} from './verification';

// Passwordless — runtime constant + types
export { NEST_AUTH_PASSWORDLESS_PROVIDER } from './passwordless';
export type { PasswordlessChannel, IPasswordlessSendRequest, IPasswordlessLoginRequest } from './passwordless';

// Admin — all types
export type {
    IAdminUser,
} from './admin';

// Config — runtime enum + types
export { TenantModeEnum } from './config';
export type {
    IEmailAuthConfig,
    IPhoneAuthConfig,
    IPasswordlessAuthConfig,
    IOAuthProviderPublicConfig,
    IProfileFieldOption,
    IProfileField,
    IRegistrationConfig,
    IMfaConfig,
    IMultipleAccountsConfig,
    IPlatformAccessPublicConfig,
    ITenantOption,
    ITenantsConfig,
    ISsoProviderConfig,
    ISsoConfig,
    IUiConfig,
    INestAuthTenantOptions,
    IClientConfig,
} from './config';

// User (from user.ts) — type
export type { INestAuthUser } from './user';

// Role & Permission (from role.ts) — all types
export type {
    INestAuthRoleTenant,
    INestAuthRole,
    INestAuthPermission,
    ICreateRoleInput,
    IUpdateRoleInput,
    IUpdatePermissionInput,
    IRoleResponse,
} from './role';

// Tenant (from tenant.ts) — all types
export type {
    INestAuthTenant,
    INestAuthUserAccess,
} from './tenant';
