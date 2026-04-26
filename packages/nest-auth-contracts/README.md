# @ackplus/nest-auth-contracts

Shared TypeScript types and enums consumed by:

- [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth)
- [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client)
- [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react)

This package contains no runtime code — types only. Importing it adds zero kilobytes to your bundle.

## Documentation

Browse the full type reference at [ack-solutions.github.io/nest-auth/docs/api-reference/types](https://ack-solutions.github.io/nest-auth/docs/api-reference/types).

## Install

```bash
pnpm add @ackplus/nest-auth-contracts
```

You usually don't install this directly — it ships as a dependency of `@ackplus/nest-auth*`. Install it explicitly when you want to type-check code that consumes the auth API without pulling in the full backend or client package.

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
```

## License

MIT
