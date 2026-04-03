import { Type } from '@nestjs/common';
import { MFAOptions } from './mfa-options.interface';
import { CookieOptions, SessionOptions } from './session-options.interface';
import { BaseAuthProvider } from '../providers/base-auth.provider';
import { DebugLogOptions } from '../services/debug-logger.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionPayload, JWTTokenPayload } from './token-payload.interface';
import { NestAuthSignupRequestDto } from '../../auth/dto/requests/signup.request.dto';
import { INestAuthTenantOptions, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { Request } from 'express';
import { NestAuthPlatformAccess, NestAuthUserAccess } from '../entities';

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
     * getSessionUserData: (user) => ({
     *     id: user.id,
     *     email: user.email,
     *     roles: user.userAccesses?.map(access => access.roles).flat()
     * })
     * ```
     */
    getSessionUserData?: (user: NestAuthUser) => Promise<any> | any;

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
 * Registration lifecycle hooks for signup flow
 * Called after user is created but BEFORE session is generated
 */
export interface IRegistrationHooks {
    /**
     * Called before user is created.
     * Use this to modify the user data before creation.
     * 
     * @param request - The original signup request data
     * @param input - The original signup request data
     * @returns Modified user data or void
     * 
     * @example
     * ```typescript
     * beforeSignup: async (request, input) => ({
     *     orgId: request.orgId,
     *     tenantId: request.tenantId
     * })
     * ```
     */
    beforeSignup?: (input: NestAuthSignupRequestDto, context: { request: any }) => Promise<NestAuthSignupRequestDto> | NestAuthSignupRequestDto;
    /**
     * Called after user is created but BEFORE session is created.
     * Use this to assign roles, create related records, etc.
     * Changes made here WILL be reflected in the session/tokens.
     * 
     * @param user - The created user entity
     * @param input - The original signup request data
     * @param context - Additional context (request, etc.)
     * @returns Modified user or void
     * 
     * @example
     * ```typescript
     * onSignup: async (user, input, context) => {
     *     // Assign default role - this WILL be in the session
     *     const defaultRole = await roleService.findByName('user');
     *     user.userAccesses = [defaultRole];
     *     await userRepository.save(user);
     *     return user;
     * }
     * ```
     */
    onSignup?: (user: NestAuthUser, input: any, context?: { request?: any }) => Promise<void> | void;
}

/**
 * Login lifecycle hooks
 * Called after user is authenticated but BEFORE session is generated
 */
export interface ILoginHooks {
    /**
     * Called after user is validated but BEFORE session is created.
     * Use this to update user data, sync roles, etc.
     * Changes made here WILL be reflected in the session/tokens.
     * 
     * @param user - The authenticated user entity
     * @param input - The original login request data
     * @param context - Additional context (request, provider, etc.)
     * @returns Modified user or void
     * 
     * @example
     * ```typescript
     * onLogin: async (user, input, context) => {
     *     // Sync roles from external system
     *     const externalRoles = await fetchRolesFromExternal(user.email);
     *     user.userAccesses = await userAccessService.findByNames(externalRoles);
     *     await userRepository.save(user);
     *     return user;
     * }
     * ```
     */
    onLogin?: (user: NestAuthUser, input: any, context?: { userAccess?: NestAuthUserAccess; platformAccess?: NestAuthPlatformAccess; request?: any; provider?: any }) => Promise<void> | void;
}

/**
 * Passwordless login (email/SMS OTP and optional magic link).
 * Enable with `passwordless: { enabled: true }` and wire listeners for
 * `passwordless.code.requested` / `passwordless.magic_link.requested` events.
 */
export interface IPasswordlessOptions {
    /** Master switch (default false) */
    enabled?: boolean;
    /**
     * Create a user on first send if they do not exist (default false).
     * Requires global registration to be allowed.
     */
    allowSignUp?: boolean;
}

/**
 * OTP customization (password reset, MFA, email/phone verification, etc.).
 * Used by verification send flows for `generate`, `length`, and `codeExpiresIn`.
 */
export interface IOtpOptions {
    /**
     * Secret used to hash OTP codes at rest (HMAC-SHA256).
     * Recommended: set to a strong random value (32+ bytes) via env.
     *
     * If not provided, Nest Auth falls back to `session.jwt.secret`.
     */
    secret?: string;
    /** Custom OTP/code generation function */
    generate?: (length?: number, format?: 'numeric' | 'alphanumeric') => string | Promise<string>;
    /** Code length when using the default generator or when passing `length` to `generate` (default: 6) */
    length?: number;
    /** OTP format where applicable */
    format?: 'numeric' | 'alphanumeric';
    /**
     * TTL for email/phone verification codes (`send-email-verification` / `send-phone-verification`).
     * Ms string (e.g. `30m`) or milliseconds number. Default: `30m`.
     */
    codeExpiresIn?: number | string;
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
    passwordless?: IPasswordlessOptions;

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
   
    /**
     * Tenant support configuration.
     * When tenant.enabled is false, auth works without tenant checks.
     * When tenant.enabled is true, multi-tenant is on and tenant is required; mode is ISOLATED or SHARED.
     *
     * Example:
     * ```typescript
     * tenant: {
     *   enabled: true,
     *   mode: TenantModeEnum.ISOLATED,  // or SHARED
     * }
     * ```
     *
     * Legacy: tenantMode at root is still supported and maps to tenant options.
     */
    tenant?: INestAuthTenantOptions;
    /**
     * Guard configuration for roles and permissions.
     * Only guards listed in roleGuards may be used when creating/updating roles and permissions.
     * When not set, defaults to ['web'].
     */
    roleGuards?: string[];
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
     * Registration hooks
     * Customize signup flow with before/after callbacks
     * Use afterSignup to assign roles that need to be in the session
     */
    registrationHooks?: IRegistrationHooks;

    /**
     * Login hooks
     * Customize login flow with before/after callbacks
     * Use afterLogin to sync roles that need to be in the session
     */
    loginHooks?: ILoginHooks;

    /**
     * Guard hooks
     * Add custom pre/post authentication validation
     */
    guards?: IGuardHooks;

    /**
     * Password customization
     * Custom hashing, verification, and validation
     */
    password?: {
        passwordResetTokenExpiresIn?: number | string; // expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d"
        /**
         * Custom password hashing hook.
         * When provided, this is used to hash passwords instead of the default argon2 hash.
         */
        hash?: (password: string) => Promise<string>;
        /**
         * Custom password verification hook.
         * When provided, this is used to validate passwords instead of the default argon2 verify.
         */
        verify?: (password: string, hash: string) => Promise<boolean>;
        /**
         * Default argon2 password hashing options.
         * When not provided, the default argon2 hash is used.
         */
        argon2?: {
            memoryCost?: number; // default: 65536 (64 MiB)
            timeCost?: number; // default: 3 (3 iterations)
            parallelism?: number; // default: 4 (4 parallel threads)
        };
    };

    /**
     * Platform access configuration.
     * When enabled, platform access is used to store platform-wide roles and permissions.
     */
    platformAccess?: {
        enabled?: boolean;
        validate?: (request: Request) => Promise<boolean> | boolean;
    };
    /**
     * OTP customization (generation, length, verification code expiry — see {@link IOtpOptions}).
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
