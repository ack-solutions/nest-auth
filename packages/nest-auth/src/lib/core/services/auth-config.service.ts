import { Injectable } from '@nestjs/common';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { SessionStorageType } from '../interfaces/session-options.interface';
import { NestAuthMFAMethodEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { DEFAULT_GUARD_NAME, NEST_AUTH_TRUST_DEVICE_KEY } from '../../auth.constants';
import { generateOtp } from '../../utils/otp';
import { Request } from 'express';

@Injectable()
export class AuthConfigService {
    /**
     * Default configuration options for NestAuth module
     * This is the single source of truth for default values
     */
    private static defaultOptions: IAuthModuleOptions = {
        isGlobal: true,
        appName: 'Nest Auth',
        session: {
            accessTokenType: null,
            storageType: SessionStorageType.DATABASE,
            accessTokenValidity: '1h',
            refreshTokenValidity: '30d',
            slidingExpiration: false,
            // NOTE: no default `jwt.secret` — the consumer MUST provide one.
            // A default signing secret is a full account-takeover primitive, so
            // boot fails (see validateJwtSecret) when it's missing or insecure.
            cookieOptions: {
                httpOnly: true,
                secure: false,
            },
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
            required: false,
            trustDeviceStorageName: NEST_AUTH_TRUST_DEVICE_KEY, // it work only when pass 'trustDevice' true in verify2fa request
            trustedDeviceDuration: '7d',
        },
        tenant: {
            enabled: false,
            mode: TenantModeEnum.ISOLATED,
        },
        roleGuards: [DEFAULT_GUARD_NAME],
        adminConsole: {
            enabled: true,
            basePath: '/api/auth/admin',
            sessionCookieName: 'nest_auth_admin',
            sessionDuration: '2h',
            allowAdminManagement: true,
            cookie: {
                httpOnly: true,
                // NOTE: no `secure` default — leaving it unset lets getCookieOptions()
                // derive it from NODE_ENV (Secure in production). A shipped `false`
                // here would override that gate and send the admin cookie in cleartext.
                sameSite: 'lax' as const,
            },
        },
        debug: {
            enabled: false,
            level: 'verbose' as any,
            prefix: '[NestAuth]',
            includeTimestamp: true,
            includeContext: true
        },
        otp: {
            codeExpiresIn: '30m',
            length: 6,
            format: 'numeric',
            generate: generateOtp,
        },
        passwordless: {
            enabled: false,
            allowSignUp: false,
        },
        password: {
            passwordResetTokenExpiresIn: '1h',
        },
        platformAccess: {
            enabled: false,
            validate: (request: Request) => {
                return true;
            },
        },
    };

    private static options: IAuthModuleOptions;
    private static instance: AuthConfigService;

    constructor() {
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


    static setOptions(options: IAuthModuleOptions): void {
        const deepmerge = require('deepmerge');
        const mergedOptions = deepmerge(this.defaultOptions, options, { clone: false });

        // avoid duplicate mfa methods
        if (mergedOptions.mfa?.methods) {
            mergedOptions.mfa.methods = [...new Set(mergedOptions.mfa.methods)];
        }

        // Normalize roleGuards: treat undefined/null or empty array as missing, and deduplicate (deepmerge concatenates arrays)
        if (!mergedOptions.roleGuards || mergedOptions.roleGuards.length === 0) {
            mergedOptions.roleGuards = [DEFAULT_GUARD_NAME];
        } else {
            mergedOptions.roleGuards = [...new Set(mergedOptions.roleGuards)];
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

        // Validate the JWT signing secret (fail closed — no insecure default)
        this.validateJwtSecret(this.options);

        // Validate session configuration
        this.validateSessionOptions(this.options);

        // Validate admin console configuration
        this.validateAdminConsoleOptions(this.options);
    }

    /**
     * Validates the JWT signing secret. The library ships NO default secret: a
     * shared/known signing key lets anyone forge `{ sub: <anyUser> }` and, if the
     * `'jwt'` login provider is enabled, mint a session as any user. Boot fails
     * when the secret is missing or a known-insecure value; a merely-short secret
     * warns unless `session.jwt.validateSecretStrength` opts into hard enforcement.
     */
    private static validateJwtSecret(options: IAuthModuleOptions): void {
        const jwtCfg = options.session?.jwt;
        const secret = jwtCfg?.secret;

        if (!secret || typeof secret !== 'string' || secret.trim() === '') {
            throw new Error(
                'session.jwt.secret is required. Set it to a high-entropy (32+ byte) random value ' +
                'from an environment variable or secrets manager (e.g. secret: process.env.JWT_SECRET). ' +
                'The library no longer ships an insecure default.',
            );
        }

        const insecure = new Set(['secret', 'change-me', 'changeme', 'default', 'jwt-secret', 'your-secret', 'password']);
        if (insecure.has(secret.trim().toLowerCase())) {
            throw new Error(
                `session.jwt.secret is set to the well-known insecure value "${secret}". ` +
                'Use a high-entropy (32+ byte) random secret from a secrets manager. Rotate it regularly.',
            );
        }

        if (secret.length < 32) {
            const message =
                'session.jwt.secret is shorter than the recommended 32 characters — use a high-entropy ' +
                '32+ byte random value in production.';
            if (jwtCfg?.validateSecretStrength === true) {
                throw new Error(message);
            }
            console.warn(`[NestAuth] ${message} Set session.jwt.validateSecretStrength: true to enforce.`);
        }
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

    /**
     * Validates session configuration options
     */
    private static validateSessionOptions(options: IAuthModuleOptions): void {
        const store = options.session?.storageType;
        if (store) {
            const normalized = String(store).toLowerCase();
            const allowedStores = Object.values(SessionStorageType);

            if (!allowedStores.includes(normalized as SessionStorageType)) {
                throw new Error(
                    `Invalid session store "${store}". ` +
                    `Allowed values: ${allowedStores.join(', ')}`
                );
            }
        }

        const ttlSeconds = options.session?.redis?.ttlSeconds;
        if (ttlSeconds !== undefined) {
            if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
                throw new Error(
                    'session.redis.ttlSeconds must be a positive number of seconds.'
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

    /**
     * Returns the list of guards allowed for roles.
     * When roleGuards config is not set or empty, defaults to [DEFAULT_GUARD_NAME] ('web').
     */
    getRoleGuards(): string[] {
        const opts = AuthConfigService.getOptions();
        const allowed = opts.roleGuards;
        const list = (allowed && allowed.length > 0) ? allowed : [DEFAULT_GUARD_NAME];
        return [...new Set(list)];
    }

    /**
     * Returns true if the given guard is in the roleGuards list.
     */
    isRoleGuardAllowed(guard: string): boolean {
        return this.getRoleGuards().includes(guard);
    }
}
