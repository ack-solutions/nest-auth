export const configDocs = `
## Module Configuration

The \`NestAuthModule\` is the core of the authentication system. Configure it with all the options you need for your application.

---

## Quick Start

### Minimal Configuration
\`\`\`typescript
import { Module } from '@nestjs/common';
import { NestAuthModule } from '@ackplus/nest-auth';

@Module({
  imports: [
    NestAuthModule.forRoot({
      appName: 'My App',
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      },
    }),
  ],
})
export class AppModule {}
\`\`\`

### Full Configuration Example
\`\`\`typescript
NestAuthModule.forRoot({
  isGlobal: true,
  appName: 'My App',
  accessTokenType: 'header', // or 'cookie'
  enableAutoRefresh: true,

  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  },

  session: {
    storageType: SessionStorageType.DATABASE,
    sessionExpiry: '7d',
    maxSessionsPerUser: 5,
    slidingExpiration: true,
  },

  mfa: {
    enabled: true,
    required: false,
    methods: ['totp', 'email', 'sms'],
    otpExpiresIn: '5m',
    trustedDeviceDuration: '30d',
    trustDeviceStorageName: 'x-app-trust-token',
    allowUserToggle: true,
    allowMethodSelection: true,
  },

  defaultTenant: {
    name: 'Default Organization',
    slug: 'default-org',
  },

  registration: {
    enabled: true,
    requireInvitation: false,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/callback/google',
  },

  adminConsole: {
    enabled: true,
    basePath: '/auth/admin',
    secretKey: process.env.ADMIN_SECRET_KEY,
    sessionDuration: '2h',
  },

  debug: {
    enabled: true,
    logLevel: 'info',
  },
})
\`\`\`

---

## Core Configuration

### isGlobal
- **Type**: \`boolean\`
- **Default**: \`false\`
- **Description**: Make the module globally available in your application

\`\`\`typescript
{
  isGlobal: true, // No need to import in other modules
}
\`\`\`

### appName
- **Type**: \`string\`
- **Required**: Yes
- **Description**: Your application name (used in TOTP QR codes, emails, etc.)

\`\`\`typescript
{
  appName: 'My Awesome App',
}
\`\`\`

### accessTokenType
- **Type**: \`'header' | 'cookie'\`
- **Default**: \`'header'\`
- **Description**: How to deliver tokens to clients

**Header Mode** (Default):
- Tokens in response body
- Frontend manages storage
- Required for mobile apps

**Cookie Mode**:
- Tokens in HTTP-only cookies
- Browser handles automatically
- Better security for web apps

\`\`\`typescript
{
  accessTokenType: 'cookie', // Use cookies
}
\`\`\`

### enableAutoRefresh
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Automatically refresh expired tokens via interceptor

\`\`\`typescript
{
  enableAutoRefresh: true, // Auto-refresh on expiration
}
\`\`\`

### cookieOptions
- **Type**: \`CookieOptions\`
- **Description**: Custom cookie options (applies to both auth and admin cookies)

\`\`\`typescript
{
  cookieOptions: {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'strict',
    domain: '.myapp.com',
  },
}
\`\`\`

---

## JWT Configuration

### jwt.secret
- **Type**: \`string\`
- **Required**: Yes
- **Description**: Secret key for signing JWT tokens

\`\`\`typescript
{
  jwt: {
    secret: process.env.JWT_SECRET || 'your-very-secret-key',
  },
}
\`\`\`

### jwt.accessTokenExpiresIn
- **Type**: \`string | number\`
- **Default**: \`'15m'\`
- **Description**: Access token expiration time

\`\`\`typescript
{
  jwt: {
    accessTokenExpiresIn: '1h', // 1 hour
    // or accessTokenExpiresIn: 3600, // seconds
  },
}
\`\`\`

### jwt.refreshTokenExpiresIn
- **Type**: \`string | number\`
- **Default**: \`'7d'\`
- **Description**: Refresh token expiration time

\`\`\`typescript
{
  jwt: {
    refreshTokenExpiresIn: '30d', // 30 days
  },
}
\`\`\`

---

## Session Configuration

### session.storageType
- **Type**: \`'database' | 'redis' | 'memory'\`
- **Required**: Yes (if session is configured)
- **Description**: Where to store sessions

**Database**: Persist in your database (recommended)
**Redis**: High-performance caching
**Memory**: Development only (lost on restart)

\`\`\`typescript
{
  session: {
    storageType: SessionStorageType.DATABASE,
  },
}
\`\`\`

### session.redisUrl
- **Type**: \`string\`
- **Required**: If \`storageType === 'redis'\`
- **Description**: Redis connection URL

\`\`\`typescript
{
  session: {
    storageType: SessionStorageType.REDIS,
    redisUrl: 'redis://localhost:6379',
  },
}
\`\`\`

### session.sessionExpiry
- **Type**: \`string | number\`
- **Default**: \`'7d'\`
- **Description**: Session expiration time

\`\`\`typescript
{
  session: {
    sessionExpiry: '30d', // 30 days
  },
}
\`\`\`

### session.maxSessionsPerUser
- **Type**: \`number\`
- **Default**: \`10\`
- **Description**: Maximum concurrent sessions per user

\`\`\`typescript
{
  session: {
    maxSessionsPerUser: 5, // Limit to 5 devices
  },
}
\`\`\`

### session.slidingExpiration
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Extend session on user activity

\`\`\`typescript
{
  session: {
    slidingExpiration: true, // Keep active users logged in
  },
}
\`\`\`

---

## MFA Configuration

### mfa.enabled
- **Type**: \`boolean\`
- **Default**: \`false\`
- **Description**: Enable Multi-Factor Authentication

\`\`\`typescript
{
  mfa: {
    enabled: true,
  },
}
\`\`\`

### mfa.required
- **Type**: \`boolean\`
- **Default**: \`false\`
- **Description**: Force all users to enable MFA

\`\`\`typescript
{
  mfa: {
    enabled: true,
    required: true, // Mandatory MFA
  },
}
\`\`\`

### mfa.methods
- **Type**: \`Array<'totp' | 'email' | 'sms'>\`
- **Default**: \`['totp']\`
- **Description**: Enabled MFA methods

**totp**: Google Authenticator, Authy, etc.
**email**: Send OTP via email
**sms**: Send OTP via SMS

\`\`\`typescript
{
  mfa: {
    methods: ['totp', 'email', 'sms'],
  },
}
\`\`\`

### mfa.otpLength
- **Type**: \`number\`
- **Default**: \`6\`
- **Description**: Length of OTP codes

\`\`\`typescript
{
  mfa: {
    otpLength: 6, // 6-digit codes
  },
}
\`\`\`

### mfa.otpExpiresIn
- **Type**: \`string | number\`
- **Default**: \`'5m'\`
- **Description**: OTP code expiration time

\`\`\`typescript
{
  mfa: {
    otpExpiresIn: '10m', // OTPs valid for 10 minutes
  },
}
\`\`\`

### mfa.trustedDeviceDuration
- **Type**: \`string | number\`
- **Default**: \`undefined\`
- **Description**: "Remember Me" duration for 2FA

\`\`\`typescript
{
  mfa: {
    trustedDeviceDuration: '30d', // Trust device for 30 days
  },
}
\`\`\`

### mfa.trustDeviceStorageName
- **Type**: \`string\`
- **Default**: \`'nest_auth_device_trust'\`
- **Description**: Cookie/header name for trust token

\`\`\`typescript
{
  mfa: {
    trustDeviceStorageName: 'x-my-app-trust-token',
  },
}
\`\`\`

### mfa.allowUserToggle
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Allow users to enable/disable their MFA

\`\`\`typescript
{
  mfa: {
    allowUserToggle: false, // Admin controls MFA
  },
}
\`\`\`

### mfa.allowMethodSelection
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Allow users to choose their MFA method

\`\`\`typescript
{
  mfa: {
    allowMethodSelection: true,
  },
}
\`\`\`

### mfa.totp
- **Type**: \`{ issuer: string; period: number }\`
- **Description**: TOTP configuration

\`\`\`typescript
{
  mfa: {
    totp: {
      issuer: 'My App', // Shown in authenticator app
      period: 30, // Code refresh period (seconds)
    },
  },
}
\`\`\`

---

## SSO Provider Configuration

### Google OAuth
\`\`\`typescript
{
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/callback/google',
  },
}
\`\`\`

### Facebook OAuth
\`\`\`typescript
{
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: 'http://localhost:3000/auth/callback/facebook',
  },
}
\`\`\`

### GitHub OAuth
\`\`\`typescript
{
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/callback/github',
  },
}
\`\`\`

### Apple Sign In
\`\`\`typescript
{
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
    redirectUri: 'http://localhost:3000/auth/callback/apple',
  },
}
\`\`\`

---

## Authentication Methods

### emailAuth
- **Type**: \`{ enabled: boolean }\`
- **Default**: \`{ enabled: true }\`
- **Description**: Enable email/password authentication

\`\`\`typescript
{
  emailAuth: {
    enabled: true,
  },
}
\`\`\`

### phoneAuth
- **Type**: \`{ enabled: boolean }\`
- **Default**: \`{ enabled: false }\`
- **Description**: Enable phone/password authentication

\`\`\`typescript
{
  phoneAuth: {
    enabled: true,
  },
}
\`\`\`

---

## Registration Configuration

### registration.enabled
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Allow user registration/signup

\`\`\`typescript
{
  registration: {
    enabled: true,
  },
}
\`\`\`

### registration.requireInvitation
- **Type**: \`boolean\`
- **Default**: \`false\`
- **Description**: Require invitation code for signup

\`\`\`typescript
{
  registration: {
    requireInvitation: true, // Invite-only
  },
}
\`\`\`

### registration.collectProfileFields
- **Type**: \`Array<RegistrationCollectProfileField>\`
- **Description**: Custom fields to collect during signup

\`\`\`typescript
{
  registration: {
    collectProfileFields: [
      {
        id: 'firstName',
        label: 'First Name',
        type: 'text',
        required: true,
        placeholder: 'John',
      },
      {
        id: 'companySize',
        label: 'Company Size',
        type: 'select',
        required: false,
        options: [
          { label: '1-10', value: '1-10' },
          { label: '11-50', value: '11-50' },
          { label: '50+', value: '50+' },
        ],
      },
    ],
  },
}
\`\`\`

---

## Tenant Configuration

### defaultTenant
- **Type**: \`DefaultTenantOptions\`
- **Description**: Configure default tenant for single-tenant apps

\`\`\`typescript
{
  defaultTenant: {
    name: 'My Organization',
    slug: 'my-org', // lowercase, no spaces
    description: 'Default tenant',
    metadata: {
      plan: 'enterprise',
    },
  },
}
\`\`\`

**Use Case**: Single-tenant applications where \`tenantId\` is always the same. Users don't need to provide \`tenantId\` in signup/login requests.

---

## Password Reset Configuration

### passwordResetOtpExpiresIn
- **Type**: \`string | number\`
- **Default**: \`'15m'\`
- **Description**: Password reset OTP expiration time

\`\`\`typescript
{
  passwordResetOtpExpiresIn: '30m', // 30 minutes
}
\`\`\`

### passwordResetTokenExpiresIn
- **Type**: \`string | number\`
- **Default**: \`'1h'\`
- **Description**: Password reset token expiration time

\`\`\`typescript
{
  passwordResetTokenExpiresIn: '2h', // 2 hours
}
\`\`\`

---

## Admin Console Configuration

### adminConsole.enabled
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Enable embedded admin dashboard

\`\`\`typescript
{
  adminConsole: {
    enabled: true,
  },
}
\`\`\`

### adminConsole.basePath
- **Type**: \`string\`
- **Default**: \`'/auth/admin'\`
- **Description**: URL path for admin console

\`\`\`typescript
{
  adminConsole: {
    basePath: '/admin', // Access at /admin
  },
}
\`\`\`

### adminConsole.secretKey
- **Type**: \`string\`
- **Description**: Secret key for admin operations and signup

\`\`\`typescript
{
  adminConsole: {
    secretKey: process.env.ADMIN_SECRET_KEY,
  },
}
\`\`\`

### adminConsole.sessionDuration
- **Type**: \`string | number\`
- **Default**: \`'2h'\`
- **Description**: Admin session duration

\`\`\`typescript
{
  adminConsole: {
    sessionDuration: '8h', // 8-hour sessions
  },
}
\`\`\`

### adminConsole.allowAdminManagement
- **Type**: \`boolean\`
- **Default**: \`true\`
- **Description**: Allow managing other admins through UI

\`\`\`typescript
{
  adminConsole: {
    allowAdminManagement: true,
  },
}
\`\`\`

---

## Client Config Customization

### clientConfig.factory
- **Type**: \`Function\`
- **Description**: Customize the \`/auth/client-config\` response

\`\`\`typescript
{
  clientConfig: {
    factory: async (defaultConfig, context) => {
      return {
        ...defaultConfig,
        customField: 'value',
        features: {
          socialLogin: true,
          biometrics: false,
        },
      };
    },
  },
}
\`\`\`

---

## Debug Configuration

### debug.enabled
- **Type**: \`boolean\`
- **Default**: \`false\`
- **Description**: Enable debug logging

\`\`\`typescript
{
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'debug',
  },
}
\`\`\`

---

## Async Configuration

For dynamic configuration (loading from database, config service, etc.):

\`\`\`typescript
import { ConfigService } from '@nestjs/config';

NestAuthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    appName: configService.get('APP_NAME'),
    jwt: {
      secret: configService.get('JWT_SECRET'),
      accessTokenExpiresIn: configService.get('JWT_EXPIRES_IN'),
    },
    mfa: {
      enabled: configService.get('MFA_ENABLED') === 'true',
      methods: configService.get('MFA_METHODS')?.split(',') || ['totp'],
    },
    google: {
      clientId: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      redirectUri: configService.get('GOOGLE_REDIRECT_URI'),
    },
  }),
})
\`\`\`

---

## Common Configuration Patterns

### Production Web App (Cookie Mode)
\`\`\`typescript
NestAuthModule.forRoot({
  appName: 'My App',
  accessTokenType: 'cookie',
  enableAutoRefresh: true,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  },
  session: {
    storageType: SessionStorageType.REDIS,
    redisUrl: process.env.REDIS_URL,
    sessionExpiry: '7d',
    maxSessionsPerUser: 3,
  },
  mfa: {
    enabled: true,
    required: false,
    methods: ['totp', 'email'],
    trustedDeviceDuration: '30d',
  },
  cookieOptions: {
    secure: true,
    sameSite: 'strict',
  },
})
\`\`\`

### Mobile App (Header Mode)
\`\`\`typescript
NestAuthModule.forRoot({
  appName: 'My Mobile App',
  accessTokenType: 'header', // Required for mobile
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: '1h',
    refreshTokenExpiresIn: '30d',
  },
  mfa: {
    enabled: true,
    methods: ['totp', 'sms'],
    trustedDeviceDuration: '90d', // Longer for mobile
  },
})
\`\`\`

### Enterprise Multi-Tenant
\`\`\`typescript
NestAuthModule.forRoot({
  appName: 'Enterprise Platform',
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  session: {
    storageType: SessionStorageType.DATABASE,
    maxSessionsPerUser: 10,
  },
  mfa: {
    enabled: true,
    required: true, // Mandatory for all users
    methods: ['totp'],
    allowUserToggle: false, // Admin controls
  },
  registration: {
    enabled: false, // Invite-only
    requireInvitation: true,
  },
  adminConsole: {
    enabled: true,
    secretKey: process.env.ADMIN_SECRET,
  },
})
\`\`\`

### Simple Single-Tenant App
\`\`\`typescript
NestAuthModule.forRoot({
  appName: 'My Simple App',
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  defaultTenant: {
    name: 'Default',
    slug: 'default',
  },
})
\`\`\`

---

## Error Handling & Error Codes

### Overview

All error responses from nest-auth include a standardized \`code\` field that allows you to implement custom error messages and internationalization in your client applications.

### Error Response Structure

\`\`\`json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "code": "INVALID_CREDENTIALS",
  "timestamp": "2025-12-06T14:18:37.000Z",
  "path": "/auth/login"
}
\`\`\`

### Available Error Codes

#### Authentication Errors (\`AUTH_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`REGISTRATION_DISABLED\` | Registration is disabled | 403 |
| \`EMAIL_ALREADY_EXISTS\` | Email already registered | 400 |
| \`PHONE_ALREADY_EXISTS\` | Phone already registered | 400 |
| \`PROVIDER_NOT_FOUND\` | Auth provider not found or disabled | 500 |
| \`INVALID_CREDENTIALS\` | Invalid login credentials | 401 |
| \`INVALID_PROVIDER\` | Invalid auth provider | 401 |
| \`MISSING_REQUIRED_FIELDS\` | Required fields missing | 400 |
| \`USER_NOT_FOUND\` | User not found | 401 |
| \`ACCOUNT_SUSPENDED\` | User account is suspended | 401 |
| \`ACCOUNT_INACTIVE\` | User account is inactive | 401 |
| \`EMAIL_NOT_VERIFIED\` | Email not verified | 401 |
| \`CURRENT_PASSWORD_INCORRECT\` | Current password mismatch | 400 |
| \`NEW_PASSWORD_SAME_AS_CURRENT\` | New password same as old | 400 |
| \`PASSWORD_RESET_INVALID_REQUEST\` | Invalid password reset request | 400 |
| \`PASSWORD_RESET_TOKEN_INVALID\` | Invalid password reset token | 400 |
| \`PASSWORD_RESET_TOKEN_EXPIRED\` | Password reset token expired | 400 |
| \`REFRESH_TOKEN_INVALID\` | Invalid refresh token | 401 |
| \`REFRESH_TOKEN_EXPIRED\` | Refresh token expired | 401 |
| \`INVALID_TOKEN\` | Invalid token | 401 |
| \`TOKEN_EXPIRED\` | Token expired | 401 |
| \`EMAIL_ALREADY_VERIFIED\` | Email already verified | 400 |
| \`VERIFICATION_CODE_INVALID\` | Invalid verification code | 400 |
| \`VERIFICATION_CODE_EXPIRED\` | Verification code expired | 400 |
| \`NO_EMAIL_ADDRESS\` | User has no email address | 400 |
| \`NO_PHONE_NUMBER\` | User has no phone number | 400 |

#### MFA Errors (\`MFA_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`MFA_NOT_ENABLED\` | MFA not enabled for app | 403 |
| \`MFA_REQUIRED\` | MFA verification required | 401 |
| \`MFA_CODE_INVALID\` | Invalid MFA code | 401 |
| \`MFA_CODE_EXPIRED\` | MFA code expired | 401 |
| \`MFA_METHOD_NOT_AVAILABLE\` | MFA method not available | 400 |
| \`MFA_TOGGLING_NOT_ALLOWED\` | MFA toggling not allowed | 403 |
| \`MFA_CANNOT_ENABLE_WITHOUT_METHOD\` | Need verified MFA method | 403 |
| \`MFA_RECOVERY_CODE_INVALID\` | Invalid recovery code | 401 |
| \`TOTP_SETUP_FAILED\` | TOTP setup failed | 400 |
| \`TOTP_VERIFICATION_FAILED\` | TOTP verification failed | 401 |

#### Session Errors (\`SESSION_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`SESSION_NOT_FOUND\` | Session not found | 401 |
| \`SESSION_EXPIRED\` | Session expired | 401 |
| \`SESSION_INVALID\` | Invalid session | 401 |
| \`MAX_SESSIONS_REACHED\` | Max sessions reached | 403 |

#### Guard Errors (\`GUARD_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`NO_AUTH_PROVIDED\` | No authentication provided | 401 |
| \`INVALID_AUTH_FORMAT\` | Invalid auth header format | 401 |
| \`INVALID_AUTH_TYPE\` | Invalid auth type | 401 |
| \`UNAUTHORIZED\` | Unauthorized access | 401 |
| \`ACCESS_DENIED\` | Access denied | 403 |
| \`FORBIDDEN\` | Forbidden | 403 |
| \`NO_ROLES_ASSIGNED\` | No roles assigned | 403 |
| \`MISSING_REQUIRED_ROLES\` | Missing required roles | 403 |
| \`MISSING_REQUIRED_PERMISSIONS\` | Missing required permissions | 403 |

#### API Key Errors (\`API_KEY_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`INVALID_API_KEY_FORMAT\` | Invalid API key format | 401 |
| \`INVALID_API_KEY\` | Invalid API key | 401 |
| \`API_KEY_EXPIRED\` | API key expired | 401 |
| \`API_KEY_DEACTIVATED\` | API key deactivated | 401 |
| \`API_KEY_NOT_FOUND\` | API key not found | 404 |

#### Validation Errors (\`VALIDATION_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`EMAIL_OR_PHONE_REQUIRED\` | Email or phone required | 400 |
| \`TENANT_ID_REQUIRED\` | Tenant ID required | 400 |
| \`INVALID_INPUT\` | Invalid input data | 400 |
| \`MISSING_REQUIRED_FIELD\` | Missing required field | 400 |
| \`INVALID_EMAIL_FORMAT\` | Invalid email format | 400 |
| \`INVALID_PHONE_FORMAT\` | Invalid phone format | 400 |

#### OTP Errors (\`OTP_ERROR_CODES\`)

| Code | Description | HTTP Status |
|------|-------------|-------------|
| \`OTP_INVALID\` | Invalid OTP code | 400 |
| \`OTP_EXPIRED\` | OTP code expired | 400 |
| \`OTP_ALREADY_USED\` | OTP already used | 400 |
| \`OTP_NOT_FOUND\` | OTP not found | 404 |

---

### Frontend Implementation Examples

#### React/TypeScript Example

\`\`\`typescript
// error-messages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect.',
  EMAIL_ALREADY_EXISTS: 'This email is already registered. Try logging in instead.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact support.',

  // MFA
  MFA_REQUIRED: 'Please enter your two-factor authentication code.',
  MFA_CODE_INVALID: 'The code you entered is incorrect. Please try again.',
  MFA_CODE_EXPIRED: 'This code has expired. Please request a new one.',

  // Session
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  SESSION_NOT_FOUND: 'Session not found. Please log in again.',

  // Default fallback
  DEFAULT: 'An error occurred. Please try again.',
};

// useAuthError.ts
import { useTranslation } from 'react-i18next';

export function useAuthError() {
  const { t } = useTranslation();

  return (error: any) => {
    const code = error?.response?.data?.code;
    if (code) {
      return t(\`errors.\${code}\`, {
        defaultValue: ERROR_MESSAGES[code] || ERROR_MESSAGES.DEFAULT
      });
    }
    return error?.message || ERROR_MESSAGES.DEFAULT;
  };
}

// Usage in component
import { useAuthError } from './useAuthError';

function LoginForm() {
  const getErrorMessage = useAuthError();

  const handleLogin = async () => {
    try {
      await authService.login(email, password);
    } catch (error) {
      toast.error(getErrorMessage(error));

      // Handle specific errors
      const code = error?.response?.data?.code;
      if (code === 'SESSION_EXPIRED') {
        router.push('/login');
      } else if (code === 'MFA_REQUIRED') {
        router.push('/verify-2fa');
      }
    }
  };
}
\`\`\`

#### Angular Example

\`\`\`typescript
// error-message.service.ts
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  private ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_ALREADY_EXISTS: 'This email is already registered',
    MFA_REQUIRED: 'Please verify with two-factor authentication',
    SESSION_EXPIRED: 'Session expired. Please log in again.',
  };

  constructor(private translate: TranslateService) {}

  getErrorMessage(error: any): string {
    const code = error?.error?.code;
    if (code) {
      return this.translate.instant(\`errors.\${code}\`, {
        defaultValue: this.ERROR_MESSAGES[code] || 'An error occurred'
      });
    }
    return error?.message || 'An error occurred';
  }

  handleError(error: any) {
    const code = error?.error?.code;
    const message = this.getErrorMessage(error);

    // Log for debugging
    console.error('Auth error:', { code, message });

    return { code, message };
  }
}

// Usage in component
import { Component } from '@angular/core';
import { ErrorMessageService } from './error-message.service';

@Component({...})
export class LoginComponent {
  constructor(private errorService: ErrorMessageService) {}

  async login() {
    try {
      await this.authService.login(this.email, this.password);
    } catch (error) {
      const { code, message } = this.errorService.handleError(error);
      this.toastr.error(message);

      if (code === 'MFA_REQUIRED') {
        this.router.navigate(['/verify-2fa']);
      }
    }
  }
}
\`\`\`

#### Vue 3 Example

\`\`\`typescript
// useAuthError.ts
import { useI18n } from 'vue-i18n';

export function useAuthError() {
  const { t } = useI18n();

  const ERROR_MESSAGES: Record<string, string> = {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_ALREADY_EXISTS: 'Email already registered',
    MFA_REQUIRED: 'Two-factor authentication required',
  };

  const getErrorMessage = (error: any) => {
    const code = error?.response?.data?.code;
    if (code) {
      return t(\`errors.\${code}\`, ERROR_MESSAGES[code] || 'An error occurred');
    }
    return error?.message || 'An error occurred';
  };

  return { getErrorMessage };
}

// Usage in component
<script setup lang="ts">
import { useAuthError } from '@/composables/useAuthError';
import { useRouter } from 'vue-router';

const { getErrorMessage } = useAuthError();
const router = useRouter();

const handleLogin = async () => {
  try {
    await authService.login(email.value, password.value);
  } catch (error) {
    const code = error?.response?.data?.code;
    toast.error(getErrorMessage(error));

    if (code === 'MFA_REQUIRED') {
      router.push('/verify-2fa');
    }
  }
};
</script>
\`\`\`

---

### Internationalization (i18n)

#### English (\`en.json\`)
\`\`\`json
{
  "errors": {
    "INVALID_CREDENTIALS": "Invalid email or password",
    "EMAIL_ALREADY_EXISTS": "This email is already registered",
    "MFA_REQUIRED": "Please verify with two-factor authentication",
    "SESSION_EXPIRED": "Your session has expired. Please log in again.",
    "ACCOUNT_SUSPENDED": "Your account has been suspended. Please contact support."
  }
}
\`\`\`

#### Spanish (\`es.json\`)
\`\`\`json
{
  "errors": {
    "INVALID_CREDENTIALS": "Correo electrónico o contraseña no válidos",
    "EMAIL_ALREADY_EXISTS": "Este correo electrónico ya está registrado",
    "MFA_REQUIRED": "Por favor verifique con autenticación de dos factores",
    "SESSION_EXPIRED": "Su sesión ha expirado. Por favor ingrese nuevamente.",
    "ACCOUNT_SUSPENDED": "Su cuenta ha sido suspendida. Póngase en contacto con soporte."
  }
}
\`\`\`

#### French (\`fr.json\`)
\`\`\`json
{
  "errors": {
    "INVALID_CREDENTIALS": "Email ou mot de passe invalide",
    "EMAIL_ALREADY_EXISTS": "Cet email est déjà enregistré",
    "MFA_REQUIRED": "Veuillez vérifier avec l'authentification à deux facteurs",
    "SESSION_EXPIRED": "Votre session a expiré. Veuillez vous reconnecter.",
    "ACCOUNT_SUSPENDED": "Votre compte a été suspendu. Veuillez contacter le support."
  }
}
\`\`\`

---

### Best Practices

1. **Always check for error codes first** before falling back to messages
2. **Use error codes for navigation logic** (e.g., redirect on \`SESSION_EXPIRED\`)
3. **Display user-friendly messages** based on error codes
4. **Log both code and message** for debugging
5. **Implement fallback messages** for unknown error codes
6. **Handle specific error codes** with custom UI/UX

#### Comprehensive Error Handler Example

\`\`\`typescript
// error-handler.ts
interface ErrorHandlerOptions {
  showToast?: boolean;
  redirect?: boolean;
  log?: boolean;
}

export class AuthErrorHandler {
  private errorActions: Record<string, (error: any) => void> = {
    SESSION_EXPIRED: () => {
      this.router.push('/login');
      this.storage.clear();
    },
    MFA_REQUIRED: () => {
      this.router.push('/verify-2fa');
    },
    ACCOUNT_SUSPENDED: () => {
      this.router.push('/suspended');
    },
    REFRESH_TOKEN_EXPIRED: () => {
      this.router.push('/login');
      this.storage.clear();
    },
  };

  constructor(
    private router: Router,
    private storage: Storage,
    private toast: ToastService,
    private logger: Logger
  ) {}

  handle(error: any, options: ErrorHandlerOptions = {}) {
    const code = error?.response?.data?.code;
    const message = this.getErrorMessage(error);

    // Log error
    if (options.log !== false) {
      this.logger.error('Auth error occurred', { code, message, error });
    }

    // Show toast
    if (options.showToast !== false) {
      this.toast.error(message);
    }

    // Execute specific action
    if (code && this.errorActions[code]) {
      this.errorActions[code](error);
    }

    return { code, message };
  }

  private getErrorMessage(error: any): string {
    const code = error?.response?.data?.code;
    if (code) {
      return this.translations[\`errors.\${code}\`] || this.fallbackMessages[code] || 'An error occurred';
    }
    return error?.message || 'An error occurred';
  }
}

// Usage
try {
  await authService.login(email, password);
} catch (error) {
  errorHandler.handle(error, {
    showToast: true,
    redirect: true,
    log: true
  });
}
\`\`\`

---

### Error Code Constants (TypeScript)

For TypeScript projects, you can import and use the error codes directly:

\`\`\`typescript
import { ERROR_CODES } from '@ackplus/nest-auth';

// Use in type-safe manner
if (error.code === ERROR_CODES.INVALID_CREDENTIALS) {
  // Handle invalid credentials
}

// Or destructure specific categories
import {
  AUTH_ERROR_CODES,
  MFA_ERROR_CODES,
  SESSION_ERROR_CODES
} from '@ackplus/nest-auth';

if (error.code === AUTH_ERROR_CODES.SESSION_EXPIRED) {
  router.push('/login');
}
\`\`\`

---

### Testing Error Scenarios

\`\`\`typescript
// __tests__/auth-errors.test.ts
import { ERROR_CODES } from '@ackplus/nest-auth';

describe('Auth Error Handling', () => {
  it('should display correct message for invalid credentials', () => {
    const error = {
      response: {
        data: {
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Invalid credentials'
        }
      }
    };

    const message = getErrorMessage(error);
    expect(message).toBe('The email or password you entered is incorrect.');
  });

  it('should redirect to login on session expiration', () => {
    const error = {
      response: {
        data: {
          code: ERROR_CODES.SESSION_EXPIRED
        }
      }
    };

    errorHandler.handle(error);
    expect(router.push).toHaveBeenCalledWith('/login');
  });
});
\`\`\`

---

## Summary

- ✅ All errors include standardized \`code\` field
- ✅ 70+ error codes covering all scenarios
- ✅ Organized by category for easy reference
- ✅ Perfect for internationalization (i18n)
- ✅ Enables custom client-side error handling
- ✅ Type-safe when using TypeScript
`;
