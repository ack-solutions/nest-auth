# @ackplus/nest-auth

[![npm version](https://img.shields.io/npm/v/@ackplus/nest-auth.svg)](https://www.npmjs.com/package/@ackplus/nest-auth)
[![npm downloads](https://img.shields.io/npm/dm/@ackplus/nest-auth.svg)](https://www.npmjs.com/package/@ackplus/nest-auth)
[![license](https://img.shields.io/npm/l/@ackplus/nest-auth.svg)](https://www.npmjs.com/package/@ackplus/nest-auth)

Full-featured authentication module for NestJS. Sessions, MFA, OAuth, passwordless, multi-tenancy, RBAC, audit logging, and an embedded admin console — all type-safe end to end.

> 📚 **Full documentation: [ack-solutions.github.io/nest-auth](https://ack-solutions.github.io/nest-auth/)**

---

## Why

Modern auth has a long checklist: email + password, OAuth, MFA, refresh-token rotation, RBAC, multi-tenancy, audit logs, an admin console. Most teams glue together five libraries (and own the integration risk) or buy a hosted vendor (and lose data ownership). `@ackplus/nest-auth` picks a third path: **a single, modular library you install in your own NestJS app, backed by your own database**.

## Install

```bash
pnpm add @ackplus/nest-auth @ackplus/nest-auth-contracts
```

Required peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/core @nestjs/typeorm @nestjs/swagger \
  @nestjs/event-emitter @nestjs/platform-express \
  typeorm class-validator class-transformer reflect-metadata rxjs
```

Optional, only if you enable the matching feature:

| Feature | Add |
| --- | --- |
| Cookie-mode sessions | `cookie-parser` |
| Redis sessions | `ioredis` |
| Google OAuth | `google-auth-library` |
| Facebook OAuth | `fb` |
| Apple OAuth | `apple-auth` |
| Rate limiting | `@nestjs/throttler` |

[Full install guide →](https://ack-solutions.github.io/nest-auth/docs/getting-started/installation/)

## What's included

| Capability | Notes |
| --- | --- |
| **9 sign-in methods** | Email + password · phone + password · passwordless OTP · magic link · Google · Facebook · Apple · GitHub · API keys + custom OAuth providers |
| **MFA** | TOTP · email OTP · SMS OTP · recovery codes · trusted-device tokens |
| **Sessions** | Database (default), Redis, or in-memory · auto-refresh · refresh-token rotation · password-hash-prefix invalidation |
| **Multi-tenancy** | `disabled` / `shared` / `isolated` modes · tenant-aware decorators · per-request context |
| **RBAC** | Roles + permissions per guard namespace (web, api, mobile) · external IDP friendly |
| **Embedded admin console** | Built-in React UI for users, roles, permissions, tenants, API keys |
| **Hooks & events** | Every lifecycle moment is overridable; full `EventEmitter2` integration |
| **Audit logging** | Structured event hook for compliance |
| **OpenAPI** | Auto-generated `@nestjs/swagger` spec for every endpoint |

## Minimal example

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [...NestAuthEntities],
      synchronize: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([...NestAuthEntities]),

    NestAuthModule.forRoot({
      appName: 'My App',
      session: { jwt: { secret: process.env.JWT_SECRET! } },
      // emailAuth: { enabled: true },        // default
      // google: { clientId, clientSecret },  // opt-in OAuth
      // mfa: { enabled: true, required: true },
      // tenant: { enabled: true, mode: TenantModeEnum.SHARED },
    }),
  ],
})
export class AppModule {}
```

That's it — you immediately get `POST /auth/signup`, `POST /auth/login`, `/auth/refresh-token`, password-reset, MFA, OAuth callbacks, and the rest of the API. Wire `EventEmitterModule.forRoot()`, `cookie-parser`, and the `AuthExceptionFilter` from the [setup checklist](https://ack-solutions.github.io/nest-auth/docs/getting-started/setup-checklist/) and ship.

## Documentation

| Section | What's there |
| --- | --- |
| [Getting Started](https://ack-solutions.github.io/nest-auth/docs/getting-started/) | Install, database setup (3 paths), env vars, quickstart for backend / React / Next.js / vanilla |
| [Core Concepts](https://ack-solutions.github.io/nest-auth/docs/concepts/) | Sessions, user model, multi-tenancy, RBAC, MFA, events, audit |
| [Authentication](https://ack-solutions.github.io/nest-auth/docs/authentication/) | One page per sign-in method |
| [Backend Reference](https://ack-solutions.github.io/nest-auth/docs/backend/) | Module config, entities, decorators, guards, services, hooks, events, error codes, admin console |
| [Production](https://ack-solutions.github.io/nest-auth/docs/production/) | Email/SMS wiring, JWT customization, scaling, CORS & security, testing |
| [Recipes](https://ack-solutions.github.io/nest-auth/docs/recipes/) | 20 copy-paste solutions — referral codes, custom OAuth, tenant switcher, etc. |
| [API Reference](https://ack-solutions.github.io/nest-auth/docs/api-reference/) | Auto-generated REST + TypeScript types |
| [FAQ & Troubleshooting](https://ack-solutions.github.io/nest-auth/docs/faq/) | Error codes → likely cause → fix |

## Companion packages

| Package | Use when |
| --- | --- |
| [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client) | Vanilla JS / Vue / Angular / Svelte / React Native client |
| [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react) | React provider, hooks, guards, and Next.js App Router helpers |
| [`@ackplus/nest-auth-contracts`](https://www.npmjs.com/package/@ackplus/nest-auth-contracts) | Shared TS types — consumed by all three |

All four packages release together with the same version number. Pin them all to the same version.

## Links

- 📚 [Documentation](https://ack-solutions.github.io/nest-auth/)
- 💬 [Issue Tracker](https://github.com/ack-solutions/nest-auth/issues)
- 📦 [GitHub Repository](https://github.com/ack-solutions/nest-auth)

## License

[MIT](https://github.com/ack-solutions/nest-auth/blob/main/LICENSE)
