# Backend setup (NestJS)

Requires NestJS 10 or 11 with TypeORM. Routes are served under `/auth/*` (after the app's global prefix, if any).

## Install

Use the project's package manager. Skip packages that are already installed.

```bash
npm i @ackplus/nest-auth @nestjs/typeorm typeorm @nestjs/event-emitter @nestjs/swagger class-validator class-transformer cookie-parser
```

## Module

Add to the root module. If `TypeOrmModule` or `EventEmitterModule` is already registered, reuse it and only add what is missing.

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';

@Module({
  imports: [
    EventEmitterModule.forRoot(), // required: without it auth events never fire
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
      adminConsole: { enabled: false },
    }),
  ],
})
export class AppModule {}
```

- `appName` and `session.jwt.secret` are the only required options. Boot fails without a secret.
- The module is global by default; inject its services anywhere.
- Config that comes from an injected service: use `forRootAsync` (see `advanced.md`). `routePrefix` only works with `forRoot`.
- Tables are named `nest_auth_*`. With `synchronize: false`, add `NestAuthEntities` to the migration data source and generate a migration.

## main.ts

```ts
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

app.use(cookieParser());                       // needed for cookie tokens
app.useGlobalPipes(new ValidationPipe({ transform: true }));
app.enableCors({
  origin: ['http://localhost:5173'],           // explicit list, never '*' with credentials
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token-type'],
});
```

The client SDK sends `x-access-token-type`; the browser blocks the preflight if CORS does not allow it. Add `nest_auth_device_trust` too when MFA trusted devices are used in header mode.

## Protect routes

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
  @Auth(true) // optional: user may be absent
  feed() {
    return { userId: RequestContext.currentUserId() };
  }
}
```

- `@Auth()` applies `NestAuthAuthGuard`. To guard the whole app instead, register it as `APP_GUARD` and mark open routes with `@Public()`.
- In services, read the caller with `RequestContext.currentUserId()`, `RequestContext.currentTenantId()`, `await RequestContext.currentUser()`.

## The app's own user data

`NestAuthUser` holds auth fields only (email, phone, password hash, verification, `metadata`). Do not add business columns to it. Keep a separate app entity keyed by the auth user id and create it from the `REGISTERED` event (see `advanced.md` → Events). Small extra signup fields can go in `metadata`.

## Codes are delivered by the app

Signup verification, password reset, passwordless and MFA all produce a code and emit an event. Add a listener that sends the email or SMS, or the flow cannot complete. See `advanced.md` → Events.
