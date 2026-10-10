# Advanced configuration

Read only the section you need.

## Events (sending codes, syncing app data)

The library emits events through `@nestjs/event-emitter`. Each handler receives an event object; the data is on `event.payload`.

```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import type {
  EmailVerificationRequestedEvent,
  PasswordResetRequestedEvent,
  UserRegisteredEvent,
} from '@ackplus/nest-auth';

@Injectable()
export class AuthMailListener {
  @OnEvent(NestAuthEvents.EMAIL_VERIFICATION_REQUESTED)
  async verification(event: EmailVerificationRequestedEvent) {
    const { user, code } = event.payload;
    // send `code` to user.email with the project's mailer
  }

  @OnEvent(NestAuthEvents.PASSWORD_RESET_REQUESTED)
  async reset(event: PasswordResetRequestedEvent) {
    const { user, code } = event.payload;
    // send `code` to user.email or user.phone
  }

  @OnEvent(NestAuthEvents.REGISTERED)
  async registered(event: UserRegisteredEvent) {
    const { user } = event.payload;
    // create the app's own profile row for user.id, assign a default role, send a welcome mail
  }
}
```

Register the listener class in a module's `providers`.

| Event (`NestAuthEvents.*`) | When | Payload includes |
|---|---|---|
| `EMAIL_VERIFICATION_REQUESTED` / `PHONE_VERIFICATION_REQUESTED` | a verification code was issued | `user`, `code` |
| `PASSWORD_RESET_REQUESTED` | forgot-password | `user`, `code` |
| `PASSWORDLESS_CODE_REQUESTED` | passwordless send | `user`, `channel`, `code` |
| `TWO_FACTOR_CODE_SENT` | MFA email/SMS challenge | `user`, `method`, `code` |
| `REGISTERED`, `LOGGED_IN`, `LOGIN_FAILED`, `LOGGED_OUT` | lifecycle | `user`, context |
| `PASSWORD_CHANGED`, `PASSWORD_RESET`, `TWO_FACTOR_ENABLED`, `TWO_FACTOR_DISABLED` | security changes | `user` |

Use events for side effects (mail, audit, sync). Use hooks (below) only when the auth flow must wait for or be changed by your code.

If the project has no mail/SMS service, ask which provider to use. For local development only, a listener may log the code.

## Hooks

Options on `NestAuthModule.forRoot`. They run inside the request and can block it.

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const hooks: Partial<IAuthModuleOptions> = {
  registrationHooks: {
    beforeSignup: async (input) => input,          // validate or reshape the signup input; throw to reject
  },
  user: {
    getSessionUserData: async (user) => ({ displayName: user.metadata?.firstName }), // extra fields on GET /auth/me
  },
  session: {
    jwt: { secret: process.env.JWT_SECRET as string },
    customizeTokenPayload: async (payload) => payload, // add claims to the access token
  },
  guards: {
    afterAuth: async (request, user, session) => {}, // runs on every authenticated request
  },
};
```

Keep hooks fast; `afterAuth` runs on every request.

## Async configuration

```ts nocheck
NestAuthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    appName: config.getOrThrow('APP_NAME'),
    session: { jwt: { secret: config.getOrThrow('JWT_SECRET') } },
  }),
});
```

`routePrefix` and `adminConsole.path` are read at module definition time and need `forRoot`.

## Abuse protection

All off by default. Add the part that was asked for.

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const security: Partial<IAuthModuleOptions> = {
  security: {
    rateLimit: { enabled: true },                         // per-IP + per-account limits on auth endpoints
    lockout: { enabled: true, maxFailedAttempts: 10, window: '15m', lockDuration: '15m' },
    captcha: {
      enabled: true,
      verify: async (token) => token.length > 0,          // call Turnstile / hCaptcha / reCAPTCHA siteverify here
    },
    csrf: { enabled: true, allowedOrigins: ['https://app.example.com'] }, // cookie mode
  },
};
```

- Rate-limit and lockout counters are in memory per instance. With more than one instance, supply `rateLimit.store` backed by Redis.
- Behind a proxy set Express `trust proxy` so the client IP is real.
- CAPTCHA tokens arrive in the `x-captcha-token` header; allow it in CORS.
- On the app's own routes use `@RateLimit('login')` alone. It already applies its guard.

## API keys (server-to-server)

`AccessKeyService.createAccessKey(userId, name, { tenantId? })` returns the private key once. Callers send `Authorization: ApiKey <publicKey>.<privateKey>`; `@Auth()` routes accept it and act as the key's user (and tenant). Turn the feature off with `accessKeys: { enabled: false }` when the app does not issue keys.

## Admin console

An embedded dashboard for users, roles, permissions and tenants, served at `/auth/admin`. It is **enabled by default**.

- Not wanted: `adminConsole: { enabled: false }`.
- Wanted: `adminConsole: { enabled: true, secretKey: process.env.ADMIN_CONSOLE_SECRET_KEY }`. The secret gates creation of the first admin; keep it out of the repo and restrict network access to the path in production.

## Platform (cross-tenant) admins

`platformAccess: { enabled: true, validate: (request) => boolean }` plus `UserService.createPlatformUser(...)`. Only for multi-tenant products that need super-admins above all tenants. `validate` should restrict where platform roles apply (for example an internal origin or header).

## Custom login providers

Extend `BaseAuthProvider` and pass instances in `customAuthProviders`. Only when none of the built-in providers fit.

## Error codes

Errors are `{ statusCode, message, code }`. Branch on `code` (`INVALID_CREDENTIALS`, `MFA_REQUIRED`, `ACCOUNT_INACTIVE`, `RATE_LIMITED`, …). The full list is the `NestAuthErrorCode` export of `@ackplus/nest-auth-contracts`.
