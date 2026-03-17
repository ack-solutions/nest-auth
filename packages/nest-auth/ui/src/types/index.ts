export interface Permission {
    id: string;
    name: string;
    guard: string;
    description?: string;
    category?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: string;
    email: string;
    phone?: string;
    userAccesses?: UserAccess[];
    isActive: boolean;
    isVerified: boolean;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
    isMfaEnabled?: boolean;
}

/**
 * User's access within a tenant (membership + roles).
 * Use roleIds for lightweight/write operations; use roles when relations are loaded.
 */
export interface UserAccess {
    id: string;
    tenantId: string;
    tenant?: Tenant;
    /**
     * Full Role objects. Populated when the access is loaded with role relations (read/display).
     * Prefer this when you need role names, guards, or permissions for UI.
     */
    roles?: Role[];
    /**
     * Role IDs only. Use for lightweight payloads and write operations (e.g. PATCH/PUT).
     * Authoritative for serialization and persistence when saving access; keep in sync with roles when editing.
     */
    roleIds?: string[];
    isActive: boolean;
    isDefault?: boolean;
    status?: string;
    createdAt: string;
    updatedAt: string;
}

/** @deprecated Use UserAccess instead */
export type TenantMembership = UserAccess;

export interface TotpDevice {
    id: string;
    deviceName: string;
    verified: boolean;
    lastUsedAt?: string;
    createdAt: string;
}

export interface UserSessionInfo {
    id: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt?: string;
    lastActive?: string;
    expiresAt?: string;
}

export interface UserMfaDetails {
    isEnabled: boolean;
    allowUserToggle: boolean;
    availableMethods: string[];
    enabledMethods: string[];
    hasRecoveryCode: boolean;
    totpDevices: TotpDevice[];
}

export interface UserDetails {
    user: User;
    loginMethods: {
        emailEnabled: boolean;
        phoneEnabled: boolean;
        hasPassword: boolean;
    };
    mfa: UserMfaDetails;
    sessions: UserSessionInfo[];
}

export interface Role {
    id: string;
    name: string;
    guard: string;
    isSystem: boolean;
    tenantId?: string;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
}



export interface Tenant {
    id: string;
    name: string;
    slug: string;
    description?: string;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Admin {
    id: string;
    email: string;
    name?: string;
    metadata: Record<string, any>;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoginForm {
    email: string;
    password: string;
}

export interface CreateRoleForm {
    name: string;
    guard: string;
    tenantId: string;
    permissions: string;
}

export interface CreateTenantForm {
    name: string;
    slug: string;
    description: string;
}

export interface CreateAdminForm {
    email: string;
    name: string;
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
