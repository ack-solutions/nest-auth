/**
 * Auth Types
 * Contains: Login/Signup/Token types + Auth Entities (Session, Identity, AccessKey, OTP)
 */

// OTP Type Enum
export enum OTPTypeEnum {
    PASSWORD_RESET = 'password_reset',
    VERIFICATION = 'verification',
    MFA = 'mfa',
}

// MFA Method Enum (Needed for AuthResponse and others)
export enum MFAMethodEnum {
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
    type: OTPTypeEnum;
    expiresAt: Date;
    used: boolean;
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

export type ILoginCredentials = IEmailCredentials | IPhoneCredentials | ISocialCredentials | Record<string, any>;

export interface ILoginRequest {
    providerName?: 'email' | 'phone' | 'google' | 'facebook' | 'apple' | 'github' | string;
    credentials: ILoginCredentials;
    tenantId?: string;
    createUserIfNotExists?: boolean;
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

export interface ITokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface IAuthUser {
    id: string;
    email?: string;
    phone?: string;
    isVerified?: boolean;
    isMfaEnabled?: boolean;
    roles?: string[];
    permissions?: string[];
    metadata?: Record<string, any>;
    tenantId?: string;
}

export interface IAuthResponse extends ITokenPair {
    message?: string;
    isRequiresMfa?: boolean;
    mfaMethods?: MFAMethodEnum[];
    defaultMfaMethod?: MFAMethodEnum;
    user?: IAuthUser;
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
    isVerified?: boolean;
    metadata?: Record<string, any>;
}

export interface ITokensResponse {
    accessToken: string;
    refreshToken: string;
}
