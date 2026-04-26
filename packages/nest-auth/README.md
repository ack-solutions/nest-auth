# @ackplus/nest-auth

Full-featured authentication module for NestJS — sessions, MFA, OAuth, passwordless, multi-tenancy, RBAC, audit logging, and an embedded admin console.

## Documentation

**Full reference at [ack-solutions.github.io/nest-auth](https://ack-solutions.github.io/nest-auth).**

- [Getting Started](https://ack-solutions.github.io/nest-auth/docs/getting-started)
- [Backend Reference](https://ack-solutions.github.io/nest-auth/docs/backend) — module config, entities, decorators, guards, services, hooks, events, error codes
- [Authentication Methods](https://ack-solutions.github.io/nest-auth/docs/authentication)
- [Production](https://ack-solutions.github.io/nest-auth/docs/production)

## Install

```bash
pnpm add @ackplus/nest-auth @ackplus/nest-auth-contracts
```

Plus peer dependencies (NestJS, TypeORM, class-validator, etc.) — see the [installation page](https://ack-solutions.github.io/nest-auth/docs/getting-started/installation).

## Minimal example

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({ /* …, */ entities: [...NestAuthEntities] }),
    TypeOrmModule.forFeature([...NestAuthEntities]),
    NestAuthModule.forRoot({
      appName: 'My App',
      session: { jwt: { secret: process.env.JWT_SECRET! } },
    }),
  ],
})
export class AppModule {}
```

## License

MIT
