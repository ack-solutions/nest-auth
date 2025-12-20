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
    tenantId?: string;
    isActive: boolean;
    isVerified: boolean;
    metadata: Record<string, any>;
    roles: string[];
    createdAt: string;
    updatedAt: string;
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
    isMfaEnabled?: boolean;
}

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

export interface CreateUserForm {
    email: string;
    tenantId: string;
    password?: string;
    roles: string;
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
