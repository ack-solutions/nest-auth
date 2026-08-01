/**
 * Config Types
 * Client configuration response types (public `GET /auth/client-config`)
 */

import { NestAuthMFAMethodEnum } from './auth';

export interface IEmailAuthConfig {
    enabled: boolean;
}

export interface IPhoneAuthConfig {
    enabled: boolean;
}

/** Passwordless OTP / magic-link capability for login UI. */
export interface IPasswordlessAuthConfig {
    enabled: boolean;
    /** Whether first-time send may create the user (default false). */
    allowSignUp?: boolean;
}

/** Public OAuth provider slice — never includes secrets. */
export interface IOAuthProviderPublicConfig {
    enabled: boolean;
    /** OAuth client / app id when the provider is enabled (Google, Apple, GitHub). */
    clientId?: string;
    /** Facebook uses `appId` instead of `clientId`. */
    appId?: string;
}

export interface IProfileFieldOption {
    label: string;
    value: string;
}

export interface IProfileField {
    id: string;
    label: string;
    required?: boolean;
    type?: 'text' | 'email' | 'phone' | 'select' | 'checkbox' | 'password';
    placeholder?: string;
    options?: IProfileFieldOption[];
}

export interface IRegistrationConfig {
    enabled: boolean;
    requireInvitation?: boolean;
    collectProfileFields?: IProfileField[];
}

export interface IMfaConfig {
    enabled: boolean;
    methods?: NestAuthMFAMethodEnum[];
    allowUserToggle?: boolean;
    allowMethodSelection?: boolean;
}

export interface IMultipleAccountsConfig {
    enabled: boolean;
}

export interface IPlatformAccessPublicConfig {
    /** Whether platform-admin login path is configured (`platformAccess.enabled`). */
    enabled: boolean;
}

export interface ITenantOption {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    metadata?: Record<string, any>;
}

/**
 * Tenant support configuration.
 * - enabled: false → no tenant checks; auth works without tenant (future-safe: entities remain).
 * - enabled: true → multi-tenant is on; tenant is required; mode controls behavior:
 *   - ISOLATED: one tenant per user (user belongs to one tenant).
 *   - SHARED: user can belong to multiple tenants; active tenant from header/subdomain/JWT/custom.
 */
export interface INestAuthTenantOptions {
    /** When false, tenant resolution and validation are disabled. When true, multi-tenant is enabled and tenant is required. Default: false. */
    enabled?: boolean;
    /** When enabled, use ISOLATED (one tenant per user) or SHARED (multiple tenants per user). Default: ISOLATED. */
    mode?: TenantModeEnum;
}

export enum TenantModeEnum {
    ISOLATED = 'isolated',
    SHARED = 'shared',
}

export interface ITenantsConfig {
    enabled?: boolean;
    mode: TenantModeEnum;
    options?: ITenantOption[];
}

export interface ISsoProviderConfig {
    id: string;
    name: string;
    logoUrl?: string;
    authorizationUrl?: string;
    clientId?: string;
    hint?: string;
}

export interface ISsoConfig {
    enabled: boolean;
    providers?: ISsoProviderConfig[];
}

export interface IUiConfig {
    brandName?: string;
    brandColor?: string;
    logoUrl?: string;
    backgroundImageUrl?: string;
}

/**
 * Public client configuration returned by `GET /auth/client-config`.
 * Lets a UI adapt to the backend (auth methods, OAuth client ids, MFA, tenants, …)
 * without hardcoding. Shape may be extended by `clientConfig.factory`.
 */
export interface IClientConfig {
    tenants?: ITenantsConfig | INestAuthTenantOptions;
    multipleAccounts?: IMultipleAccountsConfig;
    roleGuards?: string[];
    emailAuth?: IEmailAuthConfig;
    phoneAuth?: IPhoneAuthConfig;
    passwordless?: IPasswordlessAuthConfig;
    google?: IOAuthProviderPublicConfig;
    facebook?: IOAuthProviderPublicConfig;
    apple?: IOAuthProviderPublicConfig;
    github?: IOAuthProviderPublicConfig;
    /** Names of registered `customAuthProviders` (public identifiers only). */
    customProviders?: string[];
    registration?: IRegistrationConfig;
    mfa?: IMfaConfig;
    platformAccess?: IPlatformAccessPublicConfig;
    /** How access tokens are delivered (`session.accessTokenType`). */
    accessTokenType?: 'header' | 'cookie' | null;
    sso?: ISsoConfig;
    ui?: IUiConfig;
    [key: string]: unknown;
}
