/**
 * Domain types come from `@ackplus/nest-auth-contracts`. This file re-exports them under
 * convenient aliases and defines only admin-dashboard shapes (aggregates, forms, config).
 */
import type {
    IAdminUser,
    ICreateRoleInput,
    IEmailCredentials,
    IMfaDevice,
    INestAuthIdentity,
    INestAuthPermission,
    INestAuthRole,
    INestAuthSession,
    INestAuthTenant,
    INestAuthTrustedDevice,
    INestAuthUser,
    INestAuthUserAccess,
} from '@ackplus/nest-auth-contracts';

/** Permission entity (API JSON may use ISO strings for dates). */
export type Permission = INestAuthPermission;

export type Role = INestAuthRole;

export type Tenant = INestAuthTenant;

/**
 * Membership row for a user in a tenant. `roleIds` may appear on admin API payloads
 * when roles are not fully hydrated.
 */
export type UserAccess = INestAuthUserAccess & { roleIds?: string[] };

/** Admin dashboard user model; `userAccesses` includes optional `roleIds` from the API. */
export type User = Omit<INestAuthUser, 'userAccesses'> & {
    userAccesses?: UserAccess[];
};

/** @deprecated Use UserAccess instead */
export type TenantMembership = UserAccess;

/** Admin user as returned to the dashboard (never includes password hash). */
export type Admin = Omit<IAdminUser, 'passwordHash'>;

export type LoginForm = IEmailCredentials;

/** Mirrors {@link ICreateRoleInput}; use for create-role forms aligned with the API. */
export type CreateRoleForm = ICreateRoleInput;

export type UserSessionInfo = INestAuthSession;

export type UserIdentityInfo = INestAuthIdentity;

/** Trusted device as shown in admin UI (token hash is never exposed). */
export type TrustedDeviceInfo = Omit<INestAuthTrustedDevice, 'tokenHash'>;

/**
 * MFA summary for the user detail endpoint (admin API). Differs from {@link IMfaStatusResponse}
 * (field names and optional flags) so it stays explicit here.
 */
export interface UserMfaDetails {
    isEnabled: boolean;
    allowUserToggle: boolean;
    availableMethods: string[];
    enabledMethods: string[];
    hasRecoveryCode: boolean;
    totpDevices: IMfaDevice[];
}

export interface UserDetails {
    user: User;
    loginMethods: {
        emailEnabled: boolean;
        phoneEnabled: boolean;
        hasPassword: boolean;
    };
    loginCapabilities?: {
        email?: {
            enabledInConfig: boolean;
            hasIdentity: boolean;
            verified: boolean;
            canPasswordLogin: boolean;
            canOtpLogin: boolean;
        };
        phone?: {
            enabledInConfig: boolean;
            hasIdentity: boolean;
            verified: boolean;
            canOtpLogin: boolean;
        };
        passwordless?: {
            enabledInConfig: boolean;
            allowSignUp: boolean;
        };
        social?: {
            enabledProviders: string[];
            identityProviders: string[];
        };
        mfa?: {
            enabledInConfig: boolean;
            requiredForAll: boolean;
            requiredForUser: boolean;
        };
    };
    mfa: UserMfaDetails;
    sessions: UserSessionInfo[];
    identities?: UserIdentityInfo[];
    trustedDevices?: TrustedDeviceInfo[];
}

export interface CreateTenantForm {
    name: string;
    slug: string;
    description: string;
}

export interface CreateAdminForm {
    email: string;
    name?: string;
    password: string;
}

export interface ApiResponse<T> {
    data?: T;
    message?: string;
    error?: string;
}

export interface DashboardConfig {
    allowAdminManagement: boolean;
}

export interface BlockedDomain {
    id: string;
    domain: string;
    source: string;
    createdAt: string;
}
