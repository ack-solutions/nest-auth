import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { IOtpOptions } from './auth-module-options.interface';

export interface MFAOptions {
    // Whether MFA is enabled for the application
    enabled?: boolean;

    // Whether MFA is required for all users
    required?: boolean;

    // Default enabled MFA methods
    methods?: NestAuthMFAMethodEnum[];

    // Default MFA method to suggest to users
    defaultMethod?: NestAuthMFAMethodEnum;

    // Default TOTP settings
    totp?: {
        issuer: string;
        period: number;
    };

    // Default SMS settings
    sms?: {
        provider: string;
        template: string;
    };

    // Default Email settings
    email?: {
        template: string;
    };

    // Whether users can enable/disable MFA
    allowUserToggle?: boolean;

    // Whether users can choose their MFA methods
    allowMethodSelection?: boolean;

    // Trusted device duration i.e '15m', '1h', '1d', '1w', '1M', '1y' , 15000
    trustedDeviceDuration?: string | number;

    // Trusted device storage name/ cookie name OR hader name (only for mobile apps)
    trustDeviceStorageName?: string;

    /**
     * Secret used for HMAC-SHA256 when persisting trusted device tokens.
     * If omitted, falls back to `session.jwt.secret` (set explicitly in production).
     */
    trustedDeviceSecret?: string;

    /** MFA OTP generation (length/format); separate from top-level {@link IOtpOptions} used for verification/password reset */
    otp?: Pick<IOtpOptions, 'length' | 'format' | 'generate'>;

}

