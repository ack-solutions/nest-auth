import { Type } from '@nestjs/common';
import { MFAOptions } from './mfa-options.interface';
import { CookieOptions, SessionOptions } from './session-options.interface';
import { BaseAuthProvider } from '../providers/base-auth.provider';
import { DebugLogOptions } from '../services/debug-logger.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionPayload, JWTTokenPayload } from './token-payload.interface';

/**
 * Default Tenant Options
 *
 * When configured, a default tenant will be automatically created on module initialization
 * and used for all authentication operations when no tenantId is explicitly provided.
 *
 * This enables single-tenant mode where users don't need to pass tenantId in signup/login requests.
 */
export interface IDefaultTenantOptions {
    /** Name of the default tenant */
    name: string;

    /**
     * Unique identifier/slug for the tenant
     * Must be lowercase, no spaces, only letters, numbers, hyphens (-) and underscores (_)
     * Examples: 'my-app', 'acme_corp', 'tenant123'
     */
    slug: string;

    /** Optional description */
    description?: string;

    /** Optional metadata */
    metadata?: Record<string, any>;
}

export interface IRegistrationCollectProfileField {
    id: string;
    label: string;
    required: boolean;
    type: 'text' | 'email' | 'phone' | 'select' | 'checkbox' | 'password';
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
}

/**
 * User lifecycle hooks for customizing user creation and serialization
 */
export interface IUserHooks {
    /**
     * Transform user data before creation.
     * Use this to set default roles, validate fields, or enrich data.
     *
     * @example
     * ```typescript
     * beforeCreate: async (userData, input) => ({
     *     ...userData,
     *     metadata: { ...userData.metadata, source: 'web' }
     * })
     * ```
     */
    beforeCreate?: (userData: Partial<NestAuthUser>, input: any) => Promise<Partial<NestAuthUser>> | Partial<NestAuthUser>;

    /**
     * Callback after user creation.
     * Use for side effects like creating related records, sending notifications.
     */
    afterCreate?: (user: NestAuthUser, input: any) => Promise<void> | void;

    /**
     * Control which user fields appear in API responses.
     *
     * @example
     * ```typescript
     * serialize: (user) => ({
     *     id: user.id,
     *     email: user.email,
     *     roles: user.roles
     * })
     * ```
     */
    serialize?: (user: NestAuthUser) => Partial<NestAuthUser>;

    /** Fields to always exclude from responses */
    sensitiveFields?: string[];
}

/**
 * Authentication response hooks
 */
export interface IAuthHooks {
    /**
     * Transform authentication response (login/signup).
     * Use to add custom data like user profile, organization info, feature flags.
     *
     * @example
     * ```typescript
     * transformResponse: async (response, user, session) => ({
     *     ...response,
     *     user: { id: user.id, email: user.email },
     *     organization: await getOrg(user.id)
     * })
     * ```
     */
    transformResponse?: (
        response: any,
        user: NestAuthUser,
        session: SessionPayload
    ) => Promise<any> | any;
}

/**
 * Password customization hooks
 */
export interface IPasswordHooks {
    /** Custom password hashing (default: Argon2id) */
    hash?: (password: string) => Promise<string>;
    /** Custom password verification */
    verify?: (password: string, hash: string) => Promise<boolean>;
    /** Password policy validation */
    validate?: (password: string) => { valid: boolean; errors?: string[] };
}

/**
 * OTP customization options
 */
export interface IOtpOptions {
    /** Custom OTP generation function */
    generate?: (length?: number) => string | Promise<string>;
    /** OTP length (default: 6) */
    length?: number;
    /** OTP format */
    format?: 'numeric' | 'alphanumeric';
}

/**
 * Guard customization hooks for pre/post auth validation
 */
export interface IGuardHooks {
    /**
     * Pre-auth validation (IP whitelist, device fingerprint, etc.)
     * Return { reject: true, reason: '...' } to block authentication.
     */
    beforeAuth?: (
        request: any,
        payload: JWTTokenPayload
    ) => Promise<void | { reject: boolean; reason?: string }>;

    /** Post-auth callback */
    afterAuth?: (
        request: any,
        user: NestAuthUser,
        session: SessionPayload
    ) => Promise<void> | void;
}

/**
 * Authorization customization hooks
 */
export interface IAuthorizationHooks {
    /** Custom role resolution */
    resolveRoles?: (user: NestAuthUser) => Promise<string[]>;
    /** Custom permission resolution */
    resolvePermissions?: (user: NestAuthUser, roles: string[]) => Promise<string[]>;
}

/**
 * Audit event structure
 */
export interface IAuthAuditEvent {
    type: 'login' | 'logout' | 'signup' | 'password_change' | 'mfa_enable' | 'session_revoke';
    userId?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    metadata?: Record<string, any>;
    timestamp: Date;
}

/**
 * Audit logging options
 */
export interface IAuditOptions {
    enabled?: boolean;
    /** Callback for audit events */
    onEvent?: (event: IAuthAuditEvent) => Promise<void> | void;
}

export interface IAuthModuleOptions {
    isGlobal?: boolean;
    appName: string;
    /**
     * Enable automatic token refresh via global interceptor.
     * When enabled, expired access tokens are automatically refreshed using refresh tokens.
     *
     * Default: true (automatic refresh enabled)
     */
    enableAutoRefresh?: boolean;
    accessTokenType?: 'header' | 'cookie';
    cookieOptions?: CookieOptions;
    jwt: {
        secret: string;
        accessTokenExpiresIn?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
        refreshTokenExpiresIn?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
        /** Custom token validation - return false to reject the token */
        validateToken?: (payload: JWTTokenPayload, session: SessionPayload) => Promise<boolean>;
    };
    google?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    facebook?: {
        appId: string;
        appSecret: string;
        redirectUri: string;
    };
    apple?: {
        clientId: string;
        teamId: string;
        keyId: string;
        privateKey: string;
        privateKeyMethod?: string;
        redirectUri: string;
    };
    github?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    phoneAuth?: {
        enabled: boolean;
    };
    emailAuth?: {
        enabled: boolean;
    };
    /**
     * Registration configuration
     * Controls user registration/signup behavior and profile fields
     */
    registration?: {
        enabled?: boolean;
        requireInvitation?: boolean;
        /**
         * Whether to automatically log in the user after signup.
         * If true (default), signup returns tokens and the user is logged in immediately.
         * If false, signup only creates the account and the user must login separately.
         */
        autoLoginAfterSignup?: boolean;
        collectProfileFields?: Array<IRegistrationCollectProfileField>;
    };
    /**
     * Client configuration customization
     * Allows extending/modifying the client-config endpoint response
     */
    clientConfig?: {
        /**
         * Factory function to customize the client config response
         * Receives the default config and can modify/return it
         */
        factory?: (defaultConfig: any, context: { configService: any; tenantService: any }) => Promise<any> | any;
    };
    mfa?: MFAOptions;
    session?: SessionOptions;
    customAuthProviders?: BaseAuthProvider[];
    passwordResetOtpExpiresIn?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    passwordResetTokenExpiresIn?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
    /**
     * Configure a default tenant for single-tenant applications.
     * When set, tenantId becomes optional in all authentication requests.
     * The default tenant is automatically created on module initialization.
     *
     * Example:
     * ```typescript
     * defaultTenant: {
     *   name: 'My App',
     *   slug: 'my-app'  // lowercase, no spaces, only a-z0-9_-
     * }
     * ```
     *
     * Legacy (deprecated):
     * ```typescript
     * defaultTenant: {
     *   name: 'My App',
     *   domain: 'myapp'  // Still supported but use 'slug' instead
     * }
     * ```
     */
    defaultTenant?: IDefaultTenantOptions;
    /**
     * Embedded admin console configuration.
     * Provides a password-protected dashboard for managing users, roles, tenants, and system settings.
     *
     * The admin console secretKey is also used for admin signup via the /signup endpoint.
     */
    adminConsole?: IAdminConsoleOptions;
    debug?: DebugLogOptions;

    // ============================================
    // CUSTOMIZATION HOOKS
    // ============================================

    /**
     * User lifecycle hooks
     * Customize user creation, validation, and serialization
     */
    user?: IUserHooks;

    /**
     * Authentication hooks
     * Customize auth responses (login/signup)
     */
    auth?: IAuthHooks;

    /**
     * Guard hooks
     * Add custom pre/post authentication validation
     */
    guards?: IGuardHooks;

    /**
     * Password customization
     * Custom hashing, verification, and validation
     */
    password?: IPasswordHooks;

    /**
     * OTP customization
     * Custom generation, format, and length
     */
    otp?: IOtpOptions;

    /**
     * Authorization hooks
     * Custom role and permission resolution
     */
    authorization?: IAuthorizationHooks;

    /**
     * Audit logging
     * Track auth events for compliance
     */
    audit?: IAuditOptions;

    /**
     * Custom error handling
     * Transform errors before sending to client
     */
    errorHandler?: (error: Error, context: 'login' | 'signup' | 'refresh' | 'mfa' | 'password_reset' | 'password_change') => any;

    /**
     * Resolve configuration dynamically based on request context.
     * Useful for multi-tenant setups, mobile apps vs web, or domain-based config.
     * 
     * @example
     * ```typescript
     * resolveConfig: async (req) => {
     *   if (req.headers['x-mobile-app']) {
     *     return { accessTokenType: 'header' };
     *   }
     *   return {};
     * }
     * ```
     */
    resolveConfig?: (context: any) => Promise<Partial<IAuthModuleOptions>> | Partial<IAuthModuleOptions>;
}

export interface IAdminConsoleOptions {
    /** Enable or disable the embedded admin console (default: true) */
    enabled?: boolean;
    /** Base path where the console is served (default: /auth/admin) */
    basePath?: string;
    /**
     * Nest Auth Admin Console Secret Key used for security operations.
     * This key is used for:
     * - Signing admin dashboard sessions
     * - Admin signup via /signup endpoint
     * - Password reset operations
     *
     * You can set this to any value you prefer:
     * - Hardcode: secretKey: 'your-secret-key-here'
     * - Environment variable: secretKey: process.env.MY_SECRET_KEY (use any variable name)
     */
    secretKey?: string;
    /** Cookie name for admin dashboard sessions (default: nest_auth_admin) */
    sessionCookieName?: string;
    /** Session duration expressed in seconds or ms string (default: 2h) */
    sessionDuration?: string | number;
    /**
    initializeEnabled?: boolean;
    /**
     * Cookie options applied to the admin session cookie.
     * httpOnly and sameSite default to true/'lax' respectively.
     */
    cookie?: CookieOptions;
    /**
     * Allow managing other dashboard admins through the console UI (default: true).
     */
    allowAdminManagement?: boolean;
}

export interface IAuthModuleAsyncOptions {
    isGlobal?: boolean;
    /**
     * Enable automatic token refresh via global interceptor.
     * When enabled, expired access tokens are automatically refreshed using refresh tokens.
     *
     * Default: true (automatic refresh enabled)
     */
    enableAutoRefresh?: boolean;
    imports?: any[];
    useFactory?: (...args: any[]) => Promise<IAuthModuleOptions> | IAuthModuleOptions;
    inject?: any[];
    useClass?: Type<IAuthModuleOptionsFactory>;
    useExisting?: Type<IAuthModuleOptionsFactory>;
}

export interface IAuthModuleOptionsFactory {
    createAuthModuleOptions(): Promise<IAuthModuleOptions> | IAuthModuleOptions;
}
