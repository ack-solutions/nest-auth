# Nest Auth

<p align="center">
  <a href="https://nestjs.com/" target="_blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Full-featured authentication for NestJS, JavaScript, and React.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/v/@ackplus/nest-auth.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/l/@ackplus/nest-auth.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/dm/@ackplus/nest-auth.svg" alt="NPM Downloads" /></a>
</p>

## 📚 Documentation

**Full documentation lives at [ack-solutions.github.io/nest-auth](https://ack-solutions.github.io/nest-auth).**

The docs cover:

- [Getting Started](https://ack-solutions.github.io/nest-auth/docs/getting-started) — install, database setup, environment, quickstarts
- [Core Concepts](https://ack-solutions.github.io/nest-auth/docs/concepts) — sessions, user model, RBAC, multi-tenancy, MFA, events
- [Authentication Methods](https://ack-solutions.github.io/nest-auth/docs/authentication) — email, phone, OAuth, passwordless, API keys
- [Backend Reference](https://ack-solutions.github.io/nest-auth/docs/backend) · [JS Client Reference](https://ack-solutions.github.io/nest-auth/docs/client) · [React Reference](https://ack-solutions.github.io/nest-auth/docs/react)
- [Production](https://ack-solutions.github.io/nest-auth/docs/production) — emails, SMS, JWT customization, scaling, security
- [Recipes](https://ack-solutions.github.io/nest-auth/docs/recipes) — 20 copy-paste solutions for common problems
- [FAQ & Troubleshooting](https://ack-solutions.github.io/nest-auth/docs/faq)

## 📦 Packages

| Package | Purpose |
|---|---|
| [`@ackplus/nest-auth`](./packages/nest-auth) | NestJS backend module |
| [`@ackplus/nest-auth-client`](./packages/nest-auth-client) | Framework-agnostic JS/TS auth client |
| [`@ackplus/nest-auth-react`](./packages/nest-auth-react) | React provider, hooks, guards, Next.js helpers |
| [`@ackplus/nest-auth-contracts`](./packages/nest-auth-contracts) | Shared TypeScript types |

All four packages release together with the same version number. Pin them all to the same version.

## ✨ Highlights

- 9 authentication methods (email, phone, OAuth ×4, passwordless, magic link, custom OAuth, API keys)
- TOTP / Email OTP / SMS OTP MFA with recovery codes and trusted devices
- Database, Redis, and in-memory session backends
- Header or HttpOnly-cookie tokens, with auto-refresh and refresh-queue deduplication
- Role-based access control with multiple parallel guard namespaces (web/api/mobile)
- Multi-tenancy in `disabled` / `shared` / `isolated` modes
- Embedded admin console for users, roles, permissions, tenants, and API keys
- Hook-driven extension surface — every lifecycle moment is overridable
- Audit logging with structured events
- Type-safe end to end across backend, client, and React

## 🚀 Quick start

```bash
pnpm add @ackplus/nest-auth @ackplus/nest-auth-contracts
```

```ts
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({ entities: [...NestAuthEntities], synchronize: true /* dev only */ }),
    TypeOrmModule.forFeature([...NestAuthEntities]),
    NestAuthModule.forRoot({
      appName: 'My App',
      session: { jwt: { secret: process.env.JWT_SECRET! } },
    }),
  ],
})
export class AppModule {}
```

For the complete walkthrough — including the boot-time wiring (`cookieParser`, CORS, EventEmitter, ValidationPipe, AuthExceptionFilter), three database setup paths, and quickstarts for backend / React / Next.js / vanilla — see [the Getting Started section](https://ack-solutions.github.io/nest-auth/docs/getting-started).

## 🛠️ Development

```bash
git clone https://github.com/ack-solutions/nest-auth.git
cd nest-auth
pnpm install
pnpm build                        # build all four packages

pnpm --filter @ackplus/nest-auth-docs dev   # docs site at http://localhost:3000

cd apps/example-nest && pnpm start:dev      # NestJS reference example
```

## 🤝 Contributing

Contributions are welcome. Please read the [release process](https://ack-solutions.github.io/nest-auth/docs/changelog/release-process) before opening a release-related PR.

1. Fork the repository
2. Create a branch
3. Make your changes
4. `pnpm build && pnpm test`
5. Open a PR

## 📄 License

MIT
