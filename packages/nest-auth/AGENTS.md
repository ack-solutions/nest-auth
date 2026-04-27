# AGENTS.md — `@ackplus/nest-auth`

> The NestJS backend module. Where most non-trivial PRs land.

## What this package is

A `@Module` you mount once via `NestAuthModule.forRoot({ ... })`. Provides every auth controller, guard, decorator, service, and entity the library exposes. Plus an embedded React admin console served from `/auth/admin`.

## Source layout

```
src/
├── index.ts                       ← public barrel (touch this when adding exports)
├── lib/
│   ├── auth/                      ← controllers, hooks, MFA, passwordless, password, verification
│   ├── core/                      ← module options, providers (OAuth/email/phone/passwordless), JWT
│   │   └── providers/             ← BaseAuthProvider + Google / Facebook / Apple / GitHub
│   ├── user/                      ← UserService, NestAuthUser entity, NestAuthIdentity, NestAuthAccessKey
│   ├── role/                      ← RoleService + NestAuthRole entity
│   ├── permission/                ← PermissionService + NestAuthPermission entity
│   ├── tenant/                    ← TenantService + tenant-context strategies
│   ├── session/                   ← SessionManagerService + repos (TypeORM/Redis/Memory)
│   ├── admin-console/             ← admin auth, admin endpoints, dashboard
│   ├── audit/                     ← AuditService
│   ├── request-context/           ← AsyncLocalStorage-backed context
│   └── auth.constants.ts          ← provider names, error codes, event names
└── tests/                         ← (currently sparse)
```

## Public exports — what's in `index.ts`

Roughly:

- **Module** — `NestAuthModule`, `NestAuthEntities` (entity bundle)
- **Decorators** — `@Auth`, `@Public`, `@SkipMfa`, `@NestAuthRoles`, `@NestAuthPermissions`, `@CurrentUser`, `@CurrentTenantId`, `@CurrentTenant`, `@CurrentUserAccess`, `@CurrentMembership`, `@CurrentAdmin`
- **Guards** — `NestAuthAuthGuard`, `AdminSessionGuard`
- **Services** — `AuthService`, `MfaService`, `PasswordService`, `UserService`, `RoleService`, `PermissionService`, `TenantService`, `AccessKeyService`, `SessionManagerService`, `JwtService`, `AuditService`, `AuthConfigService`, `AuthProviderRegistryService`, `DebugLoggerService`
- **Providers** (extensible) — `BaseAuthProvider`, `JwtAuthProvider`, `EmailAuthProvider`, `PhoneAuthProvider`, `PasswordlessAuthProvider`, `GoogleAuthProvider`, `FacebookAuthProvider`, `AppleAuthProvider`, `GitHubAuthProvider`
- **Entities** — `NestAuthUser`, `NestAuthIdentity`, `NestAuthSession`, `NestAuthAccessKey`, `NestAuthRole`, `NestAuthRolePermission`, `NestAuthPermission`, `NestAuthTenant`, `NestAuthUserAccess`, `NestAuthPlatformAccess`, `NestAuthMFASecret`, `NestAuthOTP`, `NestAuthTrustedDevice`, `NestAuthAdminUser`
- **Events** — `UserRegisteredEvent`, `UserLoggedInEvent`, `User2faVerifiedEvent`, `UserRefreshTokenEvent`, `LoggedOutEvent`, `LoggedOutAllEvent`, `PasswordReset*Event`, `EmailVerification*Event`, `PhoneVerification*Event`, `PasswordlessCodeRequestedEvent`, `TwoFactorCodeSentEvent`, `Tenant*Event`, `AccessKey*Event`
- **DTOs** — every request/response DTO with `@ApiProperty` decorators (these drive the OpenAPI spec)
- **Constants** — `NestAuthEvents`, `AUTH_ERROR_CODES`, `MFA_ERROR_CODES`, `SESSION_ERROR_CODES`, etc.
- **Utils** — `normalizedEmail`, `normalizedPhone`, `CookieHelper`, `SlugUtil`, `RoleMapper`

## Peer dependencies

Required: `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm`, `@nestjs/swagger`, `@nestjs/event-emitter`, `@nestjs/platform-express`, `typeorm`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`, `express`.

Optional (lazy-loaded — only required when feature is enabled): `cookie-parser`, `ioredis`, `google-auth-library`, `fb`, `apple-auth`.

## Module configuration

`IAuthModuleOptions` (in `src/lib/core/interfaces/auth-module-options.interface.ts`) is the giant config object. Sections:

- **Required** — `appName`
- **Auth methods** — `emailAuth`, `phoneAuth`, `passwordless`, `google`, `facebook`, `apple`, `github`, `customAuthProviders[]`
- **Registration** — `registration`, `defaultTenantOptions`
- **Sessions** — `session.{storageType, jwt, accessTokenValidity, refreshTokenValidity, accessTokenType, cookieOptions, maxSessionsPerUser, slidingExpiration, customizeSessionData, customizeTokenPayload, onCreated/onRefreshed/onRevoked}`
- **MFA** — `mfa.{enabled, required, methods, totp, sms, email, allowUserToggle, allowMethodSelection, trustedDeviceDuration, trustDeviceStorageName}`
- **Tenant** — `tenant.{enabled, mode}`, `platformAccess.{enabled, validate}`
- **Authorization** — `roleGuards[]`, `authorization.{resolveRoles, resolvePermissions}`
- **Hooks** — `user`, `auth`, `registrationHooks`, `loginHooks`, `guards`, `errorHandler`, `resolveConfig`, `clientConfig`
- **OTP/Password** — `otp.{generate, length, format, codeExpiresIn}`, `password.{hash, verify, argon2}`
- **Audit** — `audit.{enabled, onEvent}`
- **Admin console** — `adminConsole.{enabled, basePath, secretKey, sessionDuration, cookie, allowAdminManagement}`
- **Debug** — `debug.{enabled, level, useConsole, areas}`

## How a typical request flows

1. **Middleware** sets up `RequestContext` (AsyncLocalStorage).
2. **`NestAuthAuthGuard`** runs:
   - `@Public()` → bail with `next()`.
   - `guards.beforeAuth(request)` hook → can `{ reject: true, reason }`.
   - Read `Authorization` header / cookie → JWT or API key path.
   - Validate → resolve user → resolve `userAccess` for active tenant.
   - `authorization.resolveRoles` / `resolvePermissions`.
   - Check `@NestAuthRoles` / `@NestAuthPermissions` constraints.
   - MFA enforcement (skipped under `@SkipMfa()`).
   - `guards.afterAuth(request, user)` hook.
   - Populate `request.user`, `request.session`, `request.tenantId`, `request.userAccess`, `request.platformAccess`.
3. **Controller** runs with decorator-injected context.
4. **`AuthExceptionFilter`** turns thrown errors into structured responses with `errorCode`.

## Conventions

- **Add `@ApiProperty` to every public DTO field.** Without it, the OpenAPI spec has a hole.
- **Add `@ApiResponse` to controllers.** Endpoint pages on the docs site read response shapes from this.
- **Don't add business fields to `NestAuthUser`.** Consumers extend via `AppUser` (linked by `authUserId`). The library's user table is auth-only by design.
- **New events:** declare in `auth.constants.ts` (`NestAuthEvents`), create the event class in the appropriate `events/` folder, emit via `eventEmitter.emit(...)`.
- **New error codes:** add to the matching `*_ERROR_CODES` const in `auth.constants.ts`. The troubleshooting docs page is then auto-discoverable.
- **New providers:** extend `BaseAuthProvider`, register via `customAuthProviders: [new YourProvider(...)]`.

## Embedded admin console

Lives under `packages/nest-auth/ui` (separate npm install at postinstall). Don't edit the compiled output. The dashboard mounts at `adminConsole.basePath` (default `/auth/admin`).

## Testing

Sparse currently — see `.tasks/` for the "Write a real test suite" issue. When adding tests, integration tests should boot a `Test.createTestingModule` with `SessionStorageType.MEMORY` and `synchronize: true` SQLite. See the testing-your-auth docs page for the canonical patterns.

## Build

`tsup` (configured in `tsup.config.ts`). Outputs `dist/`. The `ui` subfolder is built by its own toolchain (see `packages/nest-auth/ui/package.json`).

## Docs

https://ack-solutions.github.io/nest-auth/docs/backend
