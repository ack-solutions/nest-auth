# Advanced configuration

Read only the section you need.

## Events

The library emits events through `@nestjs/event-emitter`. A handler receives an event object with the data on `event.payload`.

```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import type {
  EmailVerificationRequestedEvent,
  PasswordResetRequestedEvent,
  UserInvitedEvent,
  UserRegisteredEvent,
} from '@ackplus/nest-auth';

@Injectable()
export class AuthMailListener {
  @OnEvent(NestAuthEvents.EMAIL_VERIFICATION_REQUESTED)
  async verification(event: EmailVerificationRequestedEvent) {
    const { user, code } = event.payload;
    // send `code` to user.email
  }

  @OnEvent(NestAuthEvents.PASSWORD_RESET_REQUESTED)
  async reset(event: PasswordResetRequestedEvent) {
    const { user, code } = event.payload;
    // send `code` to user.email or user.phone
  }

  @OnEvent(NestAuthEvents.USER_INVITED)
  async invited(event: UserInvitedEvent) {
    const { user, token } = event.payload;
    // email a set-password link containing `token`
  }

  @OnEvent(NestAuthEvents.REGISTERED)
  async registered(event: UserRegisteredEvent) {
    const { user } = event.payload;
    // create the app's profile row for user.id, assign a default role, send a welcome mail
  }
}
```

Register the listener in a module's `providers`. How the message is sent is up to the project: its existing mailer, a queue, a third-party API, or a log line in local development.

| Event (`NestAuthEvents.*`) | When | Payload includes |
|---|---|---|
| `EMAIL_VERIFICATION_REQUESTED`, `PHONE_VERIFICATION_REQUESTED` | a verification code was issued | `user`, `code` |
| `EMAIL_VERIFIED`, `PHONE_VERIFIED` | verification succeeded | `user` |
| `PASSWORD_RESET_REQUESTED` | forgot-password | `user`, `code` |
| `PASSWORDLESS_CODE_REQUESTED` | passwordless send | `user`, `channel`, `code` |
| `TWO_FACTOR_CODE_SENT` | MFA email/SMS challenge | `user`, `method`, `code` |
| `USER_INVITED` | invitation issued | `user`, `token`, `isNewUser` |
| `REGISTERED`, `LOGGED_IN`, `LOGIN_FAILED`, `LOGGED_OUT`, `LOGGED_OUT_ALL`, `REFRESH_TOKEN` | session lifecycle | `user`, context |
| `PASSWORD_CHANGED`, `PASSWORD_RESET`, `TWO_FACTOR_ENABLED`, `TWO_FACTOR_DISABLED`, `TWO_FACTOR_VERIFIED`, `MFA_RECOVERY_CODE_USED` | security changes | `user` |
| `REFRESH_TOKEN_REUSE_DETECTED`, `DISPOSABLE_EMAIL_DETECTED` | security signals | ids / email |
| `USER_CREATED/UPDATED/DELETED`, `TENANT_*`, `ROLE_*`, `PERMISSION_*`, `ACCESS_KEY_*` | data changes | the entity |

## Hooks

Options on the module. They run inside the request, so they can change or reject it. Use events for fire-and-forget side effects, hooks when the flow must wait for your code. Either is valid.

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const hooks: Partial<IAuthModuleOptions> = {
  registrationHooks: {
    beforeSignup: async (input) => input,          // validate/reshape signup input; throw to reject
    onSignup: async (user) => {},
  },
  loginHooks: {
    onLogin: async (user) => {},                    // before the session is created; throw to reject
  },
  user: {
    beforeCreate: async (data) => data,
    getSessionUserData: async (user) => ({ displayName: user.metadata?.firstName }), // extra fields on GET /auth/me
  },
  auth: {
    transformResponse: async (response) => response, // reshape login/signup responses
  },
  session: {
    jwt: { secret: process.env.JWT_SECRET as string },
    customizeSessionData: async (data) => data,     // extra server-side session data
    customizeTokenPayload: async (payload) => payload, // extra access-token claims
  },
  guards: {
    afterAuth: async (request, user, session) => {}, // every authenticated request
  },
  errorHandler: (error) => error,                   // reshape auth errors
};
```

Also available: `user.afterCreate/beforeUpdate/afterUpdate/beforeDelete/afterDelete`, `guards.beforeAuth`, `session.validateToken/onCreated/onRefreshed/onRevoked`, `clientConfig.factory` (change what `GET /auth/client-config` returns), and `resolveConfig(request)` to override options per request (per domain, per client type).

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

`useClass` and `useExisting` (a class implementing `IAuthModuleOptionsFactory`) work too. `routePrefix` and `adminConsole.path` are read when the module is defined, so they need `forRoot`.

## Custom login provider

For Microsoft, Okta, an internal SSO, or any credential type the built-ins do not cover.

```ts
import { SocialAuthProvider } from '@ackplus/nest-auth';
import type { AuthProviderUser, IAuthModuleOptions } from '@ackplus/nest-auth';

class CompanySsoProvider extends SocialAuthProvider {
  providerName = 'company-sso';

  getRequiredFields(): string[] {
    return ['token'];
  }

  async validate(credentials: { token?: string }): Promise<AuthProviderUser | null> {
    if (!credentials.token) return null;
    // verify the token with the identity provider, then describe the user:
    return { userId: 'external-user-id', email: 'user@company.com', emailVerified: true };
  }
}

export const custom: Partial<IAuthModuleOptions> = {
  customAuthProviders: [new CompanySsoProvider()],
};
```

Clients log in with `login({ providerName: 'company-sso', credentials: { token } })`.

## Admin console

An embedded dashboard for users, roles, permissions and tenants at `/auth/admin`. Enabled by default.

- Keep it: `adminConsole: { enabled: true, secretKey: process.env.ADMIN_CONSOLE_SECRET_KEY }`. The secret gates creation of the first admin. Restrict network access to the path in production.
- Turn it off: `adminConsole: { enabled: false }`. The same management can be done in the app with `UserService`, `RoleService`, `PermissionService`, `TenantService`.

## Platform (cross-tenant) admins

For multi-tenant products that need super-admins above all tenants: `platformAccess: { enabled: true, validate: (request) => boolean }` and `UserService.createPlatformUser(...)`. `validate` decides on which requests platform roles apply (for example only from an internal origin). If the app manages platform users in its own UI, set `adminConsole.allowPlatformUserManagement: false` so the bundled console can't mint, grant, revoke or edit them.

## Debugging

`debug: { enabled: true }` prints the library's decisions (which guard step rejected a request, and why). Development only.

## Error codes

Errors are `{ statusCode, message, code }`. Branch on `code`; the full list is the `NestAuthErrorCode` export of `@ackplus/nest-auth-contracts`.
