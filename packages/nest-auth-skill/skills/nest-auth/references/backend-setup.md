# Backend setup (NestJS)

Needs NestJS 10 or 11 with TypeORM (any TypeORM database). Routes are served under `/auth/*`, after the app's global prefix if it has one.

## Install

Use the project's package manager and skip what is already installed.

```bash
npm i @ackplus/nest-auth @nestjs/typeorm typeorm @nestjs/event-emitter @nestjs/swagger class-validator class-transformer cookie-parser
```

`cookie-parser` is only needed for cookie transport.

## Module

If `TypeOrmModule` or `EventEmitterModule` is already registered, reuse it and add only what is missing.

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';

@Module({
  imports: [
    EventEmitterModule.forRoot(), // required: auth events do not fire without it
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [...NestAuthEntities /*, ...the app's own entities */],
    }),
    NestAuthModule.forRoot({
      appName: 'My App',
      session: {
        jwt: { secret: process.env.JWT_SECRET as string },
      },
    }),
  ],
})
export class AppModule {}
```

- Required: `appName` and `session.jwt.secret`. Everything else is optional; see `config-reference.md`.
- Entities: list `NestAuthEntities`, or use TypeORM's `autoLoadEntities: true`. Either works. Tables are named `nest_auth_*`.
- Schema: `synchronize: true` is fine for local development. With migrations, add `NestAuthEntities` to the migration data source and generate one.
- The embedded admin console is on by default. Tell the user; add `adminConsole: { enabled: false }` if they do not want it (see `advanced.md`).

Other ways to configure:

- `forRootAsync` when options come from an injected service such as `ConfigService` (see `advanced.md`). Note `routePrefix` is only read by `forRoot`.
- `isGlobal: false` if the project prefers explicit module imports.

## main.ts

```ts
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

app.use(cookieParser());                       // cookie transport only
app.useGlobalPipes(new ValidationPipe({ transform: true }));
app.enableCors({
  origin: ['http://localhost:5173'],           // explicit origins when credentials are used
  credentials: true,                           // cookie transport only
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token-type'],
});
```

Keep the project's existing pipes and CORS settings; only add what is missing. The SDK sends the `x-access-token-type` header, so CORS must allow it. Other headers to allow when the features are used: `nest_auth_device_trust` (MFA trusted devices in header mode), `x-captcha-token` (CAPTCHA).

## Protect routes

Recommended: `@Auth()` where protection is needed.

```ts
import { Controller, Get } from '@nestjs/common';
import { Auth, CurrentUser, RequestContext } from '@ackplus/nest-auth';
import type { JWTTokenPayload } from '@ackplus/nest-auth';

@Controller('orders')
export class OrdersController {
  @Get()
  @Auth() // 401 without a valid session
  list(@CurrentUser() user: JWTTokenPayload) {
    return { userId: user.sub };
  }

  @Get('feed')
  @Auth(true) // optional: works signed in or anonymous
  feed() {
    return { userId: RequestContext.currentUserId() };
  }
}
```

Other ways:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestAuthAuthGuard } from '@ackplus/nest-auth';

// Protect everything by default; mark open routes with @Public().
@Module({ providers: [{ provide: APP_GUARD, useClass: NestAuthAuthGuard }] })
export class GlobalAuthModule {}
```

- `@UseGuards(NestAuthAuthGuard)` directly, or your own guard that runs after it and reads `request.user` / `request.session`.
- Per-route switches: `@Public()`, `@SkipMfa()`, `@SkipEmailVerification()`, `@SkipMustChangePassword()`.

Reading the caller, anywhere in the request (services included):

- `RequestContext.currentUserId()`, `RequestContext.currentTenantId()`, `RequestContext.currentSession()`
- `await RequestContext.currentUser()`, `await RequestContext.currentUserAccess()` (the tenant membership with roles)
- In controllers: `@CurrentUser()` and `@CurrentUserAccess()`.

## The app's own user data

`NestAuthUser` stores auth fields (email, phone, password hash, verification state, `metadata`). Ways to keep app-specific data:

- **Recommended:** a separate entity in the app, keyed by the auth user id, created from the `REGISTERED` event (see `advanced.md`). Keeps auth upgrades independent of the app schema.
- **Small extras:** store them in the auth user's `metadata` (`UserService.updateUserMetadata(id, data)`) and expose them with `user.getSessionUserData`.
- **Extra signup fields** (name, company, …) are not stored automatically. They reach `registrationHooks.beforeSignup` / `onSignup` and the `REGISTERED` event as `payload.input`; save them there. A global `ValidationPipe` with `whitelist: true` strips unknown fields before they arrive.
- `registration.collectProfileFields` describes extra signup fields for clients that render forms from `GET /auth/client-config`.

## Sending codes

Signup verification, password reset, passwordless, MFA and invitations each produce a code or token and emit an event. The app delivers it by email or SMS with whatever service it uses. See `advanced.md` → Events.
