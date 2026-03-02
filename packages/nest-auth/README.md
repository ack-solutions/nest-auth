# @ackplus/nest-auth

A powerful, modular authentication and user management system for NestJS.

## Features

- � **Complete Auth System** - Login, generic registration, password recovery, verification.
- � **Multi-Factor Authentication** - Built-in TOTP (Authenticator App) support.
- � **Social Authentication** - Google, Facebook, Apple, GitHub integration.
- 🏢 **Multi-Tenancy** - Built-in tenant isolation and management.
- � **RBAC** - Role-Based Access Control with dynamic permissions.
- 🍪 **Flexible Session Management** - Support for JWTs via Cookies or Headers.
- � **Device Management** - Trusted device tracking.

## Installation

```bash
npm install @ackplus/nest-auth
# or
pnpm add @ackplus/nest-auth
```

## Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm class-validator class-transformer reflect-metadata @nestjs/event-emitter @nestjs/swagger
```

### Optional Dependencies (Social Auth)

If you plan to use social authentication providers:

```bash
# Google
npm install google-auth-library

# Facebook
npm install fb

# Apple
npm install apple-auth
```

## Quick Start

### 1. Import Module

```typescript
import { Module } from '@nestjs/common';
import { NestAuthModule } from '@ackplus/nest-auth';

@Module({
  imports: [
    NestAuthModule.forRoot({
      isGlobal: true,
      session: {
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
      },
      // ... other config
    }),
  ],
})
export class AppModule {}
```

### 2. Guard Routes

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { NestAuthAuthGuard } from '@ackplus/nest-auth';

@Controller('profile')
export class ProfileController {
  
  @Get()
  @UseGuards(NestAuthAuthGuard)
  getProfile(@Req() req) {
    return req.user;
  }
}
```

## Configuration

### Social Providers

```typescript
NestAuthModule.forRoot({
  google: {
    clientId: '...',
    clientSecret: '...',
  },
  facebook: {
    appId: '...',
    appSecret: '...',
  },
  // ...
})
```

### Email / SMPT

To enable email verification and password resets:

```typescript
NestAuthModule.forRoot({
  mail: {
    driver: 'smtp',
    host: 'smtp.example.com',
    // ...
  }
})
```

## Multi-Tenant Login (Password + Passwordless)

Enable login lookup (email/phone -> tenant discovery -> method login):

```typescript
NestAuthModule.forRoot({
  login: {
    enabled: true,
    mode: 'central', // 'central' | 'tenant-specific'
    password: true,
    social: true,
    passwordless: {
      otp: true,
      magicLink: true,
    },
    requireLookupToken: false,
    allowIdentifierEnumeration: false,
    lookupTokenExpiresIn: '10m',
    otpExpiresIn: '10m',
    otpLength: 6,
    magicLinkExpiresIn: '15m',
  },
});
```

Legacy `identifierFirstAuth` config is still supported for backward compatibility.

### Login Lookup Endpoints

- `POST /auth/login/lookup`
- `POST /auth/login/password`
- `POST /auth/login/otp/challenge`
- `POST /auth/login/otp/verify`
- `POST /auth/login/magic-link/challenge`
- `POST /auth/login/magic-link/verify`
- `POST /auth/login/social`

Legacy aliases are still available:
- `POST /auth/identifier/lookup`
- `POST /auth/identifier/login/password`
- `POST /auth/identifier/login/otp/challenge`
- `POST /auth/identifier/login/otp/verify`
- `POST /auth/identifier/login/magic-link/challenge`
- `POST /auth/identifier/login/magic-link/verify`
- `POST /auth/identifier/login/social`

### Running Example (Local Testing)

Use the ready-to-run script:

```bash
bash packages/nest-auth/examples/identifier-first-auth-flow.sh
```

Set variables as needed:

- `API_URL` (default: `http://localhost:3000`)
- `IDENTIFIER` (required)
- `PASSWORD` (optional, for password login test)
- `TENANT_ID` (optional, required if lookup returns multiple tenants)
- `OTP_CODE` (optional, for OTP verify step)
- `MAGIC_TOKEN` (optional, for magic link verify step when not in debug mode)
- `SOCIAL_PROVIDER` + `SOCIAL_TOKEN` (optional, for social login test)

## Session Storage Options

By default, sessions are stored in the database via TypeORM. You can switch to Redis for
multi-instance performance without changing your login/signup flows.

### Redis Setup

1) Install the optional Redis dependency:

```bash
npm install ioredis
```

2) Enable Redis sessions:

```typescript
import { SessionStorageType } from '@ackplus/nest-auth';

NestAuthModule.forRoot({
  session: {
    storageType: SessionStorageType.REDIS, // or 'redis'
    redis: {
      url: process.env.REDIS_URL, // preferred when available
      host: '127.0.0.1',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      tls: undefined,
      keyPrefix: 'nest-auth:sess:',
      ttlSeconds: 60 * 60 * 24 * 7,
      enableOfflineQueue: true,
    },
  },
});
```

Notes:
- If `session.storageType` is omitted, the database store is used (no breaking changes).
- Legacy config is still supported: `session.redisUrl`.
- Redis keys are JSON-serialized and use TTL; `ttlSeconds` defaults to the session expiry when possible.

### Production Notes

- Enable Redis persistence (AOF/RDB) for durability.
- Use Redis clustering/sentinel for high availability.
- Choose a consistent `keyPrefix` to isolate environments.
- Monitor TTL/evictions and memory usage.

## Documentation

For full documentation covering RBAC, Tenants, and advanced configuration, please refer to the official docs (link to be added).

## License

MIT
