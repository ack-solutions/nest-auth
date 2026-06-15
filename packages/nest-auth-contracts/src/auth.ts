/**
       * Auth Types
 * Contains: Login/Signup/Token types + Auth Entities (Session, Identity, AccessKey, OTP)
 */

import { INestAuthRole } from './role';
import type { INestAuthTenant, INestAuthUserAccess } from './tenant';
import { INestAuthUser } from './user';

// OTP Type Enum
export enum NestAuthOTPTypeEnum {
    PASSWORDLESS_LOGIN = 'passwordless_login',
    MAGIC_LINK_LOGIN = 'magic_link_login',
    PASSWORD_RESET = 'password_reset',
    EMAIL_VERIFICATION = 'email_verification',
    PHONE_VERIFICATION = 'phone_verification',
    MFA = 'mfa',
}

// MFA Method Enum (Needed for AuthResponse and others)
export enum NestAuthMFAMethodEnum {
    EMAIL = 'email',
    SMS = 'sms',
    TOTP = 'totp',
}

// --- Entity Interfaces ---

export interface INestAuthIdentity {
    id: string;
    provider: string;
    providerId: string;
    metadata?: Record<string, any>;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthSession {
    id: string;
    userId: string;
    data?: any;
    refreshToken?: string;
    expiresAt?: Date;
    userAgent?: string;
    deviceName?: string;
    ipAddress?: string;
    lastActive?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface INestAuthAccessKey {
    id: string;
    name: string;
    publicKey: string;
    privateKey: string;
    description?: string;
    isActive: boolean;
    expiresAt?: Date;
    lastUsedAt?: Date;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface INestAuthOTP {
    id: string;
    userId: string;
    code: string;
    type: NestAuthOTPTypeEnum;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// --- Request/Response Interfaces ---

export interface IEmailCredentials {
    email: string;
    password: string;
}

export interface IPhoneCredentials {
    phone: string;
    password: string;
}

export interface ISocialCredentials {
    token: string;
}

export interface IPasswordlessOtpLoginCredentials {
    identifier: string;
    channels?: Array<'email' | 'sms'>;
    code: string;
}

export type ILoginCredentials =
    | IEmailCredentials
    | IPhoneCredentials
    | ISocialCredentials
    | IPasswordlessOtpLoginCredentials
    | Record<string, any>;

export interface ILoginRequest {
    providerName?: 'email' | 'phone' | 'passwordless' | 'google' | 'facebook' | 'apple' | 'github' | string;
    credentials: ILoginCredentials;
    tenantId?: string;
    createUserIfNotExists?: boolean;
    guard?: string;
    /**
     * "Remember me". In cookie mode, `false` issues session cookies that clear
     * when the browser closes (good for shared devices); default keeps the
     * persistent cookies. Sticky across token refresh.
     */
    rememberMe?: boolean;
}

export interface ISignupRequest {
    email?: string;
    phone?: string;
    password: string;
    tenantId?: string;
    [key: string]: any;
}

export interface IRefreshRequest {
    refreshToken?: string;
}

export interface ISwitchTenantRequest {
    tenantId: string;
}

export interface ITokenPair {
    accessToken: string;
    refreshToken: string;
}

export type ISessionUserData<
    SerializedUser extends Record<string, any> = Record<string, any>
> = SerializedUser & Pick<INestAuthUser, 'id' | 'email' | 'phone' | 'emailVerifiedAt' | 'phoneVerifiedAt' | 'isMfaEnabled' | 'metadata'> & {
    roles?: Pick<INestAuthRole, 'id' | 'name' | 'guard'>[];
    permissions: string[];
};

// export interface ISessionUserData<SerializedUser = any> {
//     [key in SerializedUser]: SerializedUser[key];
// roles ?: INestAuthRole[];
// permissions: string[];
// }

export interface IAuthResponse extends ITokenPair {
    message?: string;
    isRequiresMfa?: boolean;
    mfaMethods?: NestAuthMFAMethodEnum[];
    defaultMfaMethod?: NestAuthMFAMethodEnum;
}

export interface IAuthSession {
    id: string;
    userId: string;
    expiresAt: string;
    createdAt: string;
}

export interface IMessageResponse {
    message: string;
}

export interface IAuthCookieResponse {
    message: string;
    isRequiresMfa?: boolean;
}

export interface IAuthSuccessResponse {
    message: string;
    isRequiresMfa?: boolean;
}

export interface IUserResponse {
    id: string;
    email?: string;
    phone?: string;
    emailVerifiedAt?: Date;
    phoneVerifiedAt?: Date;
    isMfaEnabled?: boolean;
    roles?: string[];
    permissions?: string[];
    metadata?: Record<string, any>;
    tenantId?: string;
    tenants?: INestAuthTenant[];
}

export interface ITokensResponse {
    accessToken: string;
    refreshToken: string;
}
