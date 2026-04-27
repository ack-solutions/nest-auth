# @ackplus/nest-auth-contracts

[![npm version](https://img.shields.io/npm/v/@ackplus/nest-auth-contracts.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-contracts)
[![npm downloads](https://img.shields.io/npm/dm/@ackplus/nest-auth-contracts.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-contracts)
[![license](https://img.shields.io/npm/l/@ackplus/nest-auth-contracts.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-contracts)

Shared TypeScript types and enums for the `@ackplus/nest-auth` ecosystem. **Types-only — zero runtime code, zero bundle cost.**

> 📚 **Browse every type at [ack-solutions.github.io/nest-auth/docs/api-reference/types](https://ack-solutions.github.io/nest-auth/docs/api-reference/types/)**

---

## Why this package exists

Backend, JS client, and React layer all need the same types — DTOs, enums, domain interfaces. This package is the single source of truth so a change to a request/response shape on the server breaks the client at compile time, not at runtime.

It is consumed by:

- [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth) — NestJS backend module
- [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client) — framework-agnostic JS/TS client
- [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react) — React provider, hooks, guards

You usually don't install it directly — it's a transitive dependency of all three. Install it explicitly when you want to type-check code that consumes the auth API without pulling in the full backend or client package.

## Install

```bash
pnpm add @ackplus/nest-auth-contracts
```

Both ESM and CommonJS builds ship in the package. No peer dependencies.

## What's exported

### Enums

```ts
import {
  NestAuthMFAMethodEnum,   // 'email' | 'sms' | 'totp'
  NestAuthOTPTypeEnum,     // 'passwordless_login' | 'magic_link_login' | 'password_reset' | 'email_verification' | 'phone_verification' | 'mfa'
  TenantModeEnum,          // 'isolated' | 'shared'
} from '@ackplus/nest-auth-contracts';
```

### Request DTOs

`ILoginRequest`, `ISignupRequest`, `IRefreshRequest`, `ISwitchTenantRequest`, `IVerify2faRequest`, `IToggleMfaRequest`, `IVerifyTotpSetupRequest`, `IForgotPasswordRequest`, `IResetPasswordWithTokenRequest`, `IChangePasswordRequest`, `IVerifyForgotPasswordOtpRequest`, `IVerifyEmailRequest`, `IVerifyPhoneRequest`, `IPasswordlessSendRequest`, `IInitializeAdminRequest`, `ICreateRoleInput`, `IUpdateRoleInput`, `IUpdatePermissionInput` …

### Response DTOs

`IAuthResponse`, `ITokenPair`, `IUserResponse`, `ISessionUserData`, `IMessageResponse`, `IVerify2faResponse`, `IMfaStatusResponse`, `IMfaDevice`, `ITotpSetupResponse`, `IVerifyOtpResponse`, `ISessionVerifyResponse` …

### Credential type unions

`ILoginCredentials = IEmailCredentials | IPhoneCredentials | ISocialCredentials | IPasswordlessOtpLoginCredentials`

### Domain interfaces

`INestAuthUser`, `INestAuthIdentity`, `INestAuthSession`, `INestAuthAccessKey`, `INestAuthOTP`, `INestAuthMFASecret`, `INestAuthTrustedDevice`, `INestAuthRole`, `INestAuthPermission`, `INestAuthTenant`, `INestAuthUserAccess`

### Configuration interfaces

`IEmailAuthConfig`, `IPhoneAuthConfig`, `IMfaConfig`, `IRegistrationConfig`, `INestAuthTenantOptions`, `ITenantsConfig`, `ISsoConfig`, `IUiConfig` …

[Full type reference →](https://ack-solutions.github.io/nest-auth/docs/api-reference/types/)

## Common imports

```ts
import {
  // Enums
  NestAuthMFAMethodEnum,
  NestAuthOTPTypeEnum,
  TenantModeEnum,

  // Request/response DTOs
  ILoginRequest,
  ISignupRequest,
  IAuthResponse,
  IMfaStatusResponse,
  ISessionUserData,

  // Domain interfaces
  INestAuthUser,
  INestAuthSession,
  INestAuthRole,
  INestAuthTenant,
} from '@ackplus/nest-auth-contracts';

async function login(req: ILoginRequest): Promise<IAuthResponse> {
  return fetch('/auth/login', { method: 'POST', body: JSON.stringify(req) }).then((r) => r.json());
}
```

## Naming conventions

- **Domain entities** → `INestAuth{Entity}` (e.g. `INestAuthUser`, `INestAuthRole`)
- **Enums** → `NestAuth{Name}Enum` (e.g. `NestAuthMFAMethodEnum`)
- **Request DTOs** → `I{Feature}Request`
- **Response DTOs** → `I{Feature}Response`
- **Configuration** → `I{Feature}Config` or `I{Feature}Options`

## Companion packages

| Package | Purpose |
| --- | --- |
| [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth) | NestJS backend module |
| [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client) | Framework-agnostic JS/TS client |
| [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react) | React provider, hooks, guards |

All four packages release together with the same version number. Pin them all to the same version.

## Links

- 📚 [Documentation](https://ack-solutions.github.io/nest-auth/)
- 💬 [Issue Tracker](https://github.com/ack-solutions/nest-auth/issues)
- 📦 [GitHub Repository](https://github.com/ack-solutions/nest-auth)

## License

[MIT](https://github.com/ack-solutions/nest-auth/blob/main/LICENSE)
