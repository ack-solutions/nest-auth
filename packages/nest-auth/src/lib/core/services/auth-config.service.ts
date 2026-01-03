import { Injectable, Inject, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { SessionStorageType } from '../interfaces/session-options.interface';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';

@Injectable()
export class AuthConfigService {
    /**
     * Default configuration options for NestAuth module
     * This is the single source of truth for default values
     */
    private static defaultOptions: IAuthModuleOptions = {
        isGlobal: true,
        appName: 'Nest Auth',
        passwordResetOtpExpiresIn: '15m',
        passwordResetTokenExpiresIn: '1h',
        session: {
            storageType: SessionStorageType.DATABASE,
            sessionExpiry: '1h',
            refreshTokenExpiry: '30d',
        },
        jwt: {
            secret: 'secret',
        },
        accessTokenType: null,
        cookieOptions: {
            httpOnly: true,
            secure: false,
        },
        emailAuth: {
            enabled: true,
        },
        phoneAuth: {
            enabled: false,
        },
        mfa: {
            enabled: false,
            methods: [NestAuthMFAMethodEnum.EMAIL, NestAuthMFAMethodEnum.TOTP],
            allowUserToggle: true,
            allowMethodSelection: true,
            otpLength: 6,
            otpExpiresIn: '15m',
        },
        defaultTenant: undefined,
        adminConsole: {
            enabled: true,
            basePath: '/api/auth/admin',
            sessionCookieName: 'nest_auth_admin',
            sessionDuration: '2h',
            allowAdminManagement: true,
            cookie: {
                httpOnly: true,
                secure: false,
                sameSite: 'lax' as const,
            },
        },
        debug: {
            enabled: false,
            level: 'verbose' as any,
            prefix: '[NestAuth]',
            includeTimestamp: true,
            includeContext: true
        }
    };

    private static options: IAuthModuleOptions;
    private static instance: AuthConfigService;

    constructor(
        @Inject('AUTH_MODULE_OPTIONS')
        @Optional() options?: IAuthModuleOptions
    ) {
        if (options) {
            AuthConfigService.options = options;
        }
        if (!AuthConfigService.instance) {
            AuthConfigService.instance = this;
        }
    }

    static getOptions(): IAuthModuleOptions {
        return this.options || this.defaultOptions;
    }

    static getDefaultOptions(): IAuthModuleOptions {
        return this.defaultOptions;
    }

    static getInstance(): AuthConfigService {
        if (!AuthConfigService.instance) {
            AuthConfigService.instance = new AuthConfigService();
        }
        return AuthConfigService.instance;
    }

    /**
     * Generates a secure random key using cryptographically strong random bytes.
     * Used as fallback when no key is explicitly configured.
     */
    private static generateRandomKey(length: number = 32): string {
        return randomBytes(length).toString('base64');
    }

    /**
     * Resolves the Nest Auth Admin Console Secret Key from configuration.
     * This key is used for:
     * - Signing admin dashboard sessions
     * - Admin console security operations (admin creation, password reset, etc.)
     *
     * Priority:
     * 1. Explicitly configured key (adminConsole.secretKey)
     * 2. Auto-generated random key (for development only, with warning)
     * 3. undefined (if generation is disabled)
     */
    private static resolveSecretKey(options: IAuthModuleOptions): string | undefined {
        // Check explicit configuration first
        const adminConsoleKey = options.adminConsole?.secretKey;
        if (adminConsoleKey) {
            return adminConsoleKey;
        }

        // Auto-generate for development (only if NODE_ENV is not production)
        if (process.env.NODE_ENV !== 'production') {
            const generatedKey = this.generateRandomKey(32);
            console.warn(
                '[NestAuth] Warning: adminConsole.secretKey not configured. ' +
                `Auto-generated key for development: ${generatedKey.slice(0, 20)}...\n` +
                '⚠️  This key will change on each restart. Configure adminConsole.secretKey in your AuthModuleOptions!'
            );
            return generatedKey;
        }

        return undefined;
    }

    static setOptions(options: IAuthModuleOptions): void {
        const deepmerge = require('deepmerge');
        const mergedOptions = deepmerge(this.defaultOptions, options, { clone: false });

        // avoid duplicate mfa methods
        if (mergedOptions.mfa?.methods) {
            mergedOptions.mfa.methods = [...new Set(mergedOptions.mfa.methods)];
        }

        // Ensure adminConsole exists
        if (!mergedOptions.adminConsole) {
            mergedOptions.adminConsole = {};
        }

        // Resolve and set secret key from configuration
        // This key is used for both session signing and security operations
        // After this, all code should use the config object
        if (!mergedOptions.adminConsole.secretKey) {
            console.warn('Admin console secret key not configured. Please configure adminConsole.secretKey in AuthModuleOptions to enable admin console.');
            mergedOptions.adminConsole.enabled = false;
        }

        this.options = mergedOptions;

        // Validate admin console configuration
        this.validateAdminConsoleOptions(this.options);
    }

    /**
     * Validates admin console configuration options
     */
    private static validateAdminConsoleOptions(options: IAuthModuleOptions): void {
        if (options.adminConsole?.enabled !== false && options.adminConsole?.secretKey) {
            const secretKey = options.adminConsole.secretKey;
            const weakSecrets = ['change-me-admin-secret', 'default', 'secret', ''];

            // Only validate if it's not auto-generated (auto-generated keys are base64, typically 44 chars)
            if (weakSecrets.includes(secretKey)) {
                throw new Error(
                    'Admin console requires a secure secretKey. ' +
                    'Please set adminConsole.secretKey in your AuthModuleOptions (e.g., secretKey: process.env.ADMIN_CONSOLE_SESSION_SECRET) ' +
                    'with a 32+ byte random value. Store it securely in environment variables or a secrets manager. ' +
                    'Weak or default values are not allowed for security reasons. Rotate keys regularly.'
                );
            }
        }
    }

    getConfig(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    setConfig(options: IAuthModuleOptions): void {
        AuthConfigService.setOptions(options);
    }
}
