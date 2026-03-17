/**
 * Config Types
 * Client configuration response types
 */

import { NestAuthMFAMethodEnum } from './auth';

export interface IEmailAuthConfig {
    enabled: boolean;
}

export interface IPhoneAuthConfig {
    enabled: boolean;
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
