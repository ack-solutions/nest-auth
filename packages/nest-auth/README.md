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
