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

export interface ITenantsConfig {
    mode: 'single' | 'multi';
    defaultTenantId: string | null;
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

export interface IClientConfigResponse {
    emailAuth: IEmailAuthConfig;
    phoneAuth: IPhoneAuthConfig;
    registration: IRegistrationConfig;
    mfa: IMfaConfig;
    tenants: ITenantsConfig;
    sso: ISsoConfig;
    ui?: IUiConfig;
}
