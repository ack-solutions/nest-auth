import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';

export interface MFAOptions {
    // Whether MFA is enabled for the application
    enabled?: boolean;

    // Whether MFA is required for all users
    required?: boolean;

    // Default enabled MFA methods
    methods?: NestAuthMFAMethodEnum[];

    // Default MFA method to suggest to users
    defaultMethod?: NestAuthMFAMethodEnum;

    // OTP length
    otpLength?: number;

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

    // OTP expiry time i.e '15m', '1h', '1d', '1w', '1M', '1y' , 15000
    otpExpiresIn?: string | number;

    // Trusted device duration i.e '15m', '1h', '1d', '1w', '1M', '1y' , 15000
    trustedDeviceDuration?: string | number;

    // Trusted device storage name/ cookie name OR hader name (only for mobile apps)
    trustDeviceStorageName?: string;

    // Default OTP code for development/testing (e.g. '1234')
    // If set, this code will be accepted for any user
    defaultOtp?: string;
}

