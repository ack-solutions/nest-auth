# @ackplus/nest-auth-client

Framework-agnostic JS/TS SDK for `@ackplus/nest-auth`.

## Installation

```bash
npm install @ackplus/nest-auth-client
# or
pnpm add @ackplus/nest-auth-client
```

## Quick Start

```typescript
import { AuthClient } from '@ackplus/nest-auth-client';

const client = new AuthClient({
  baseUrl: 'http://localhost:3000',
  accessTokenType: 'header', // 'header' | 'cookie' | null
});

const login = await client.login({
  providerName: 'email',
  credentials: {
    email: 'user@example.com',
    password: 'SecurePass123!',
  },
});

console.log(login.user);
```

## Login Lookup APIs

```typescript
// 1) Lookup (email/phone + tenant discovery)
const lookup = await client.identifierLookup({
  identifier: 'user@example.com',
});

// 2) Password login
const passwordLogin = await client.identifierPasswordLogin({
  lookupToken: lookup.lookupToken,
  password: 'SecurePass123!',
});

// 3) OTP login
await client.identifierOtpChallenge({ lookupToken: lookup.lookupToken });
const otpLogin = await client.identifierOtpVerify({
  lookupToken: lookup.lookupToken,
  otp: '123456',
});

// 4) Magic link login
const challenge = await client.identifierMagicLinkChallenge({
  lookupToken: lookup.lookupToken,
});
if (challenge.token) {
  await client.identifierMagicLinkVerify({ token: challenge.token });
}

// 5) Social login
await client.identifierSocialLogin({
  lookupToken: lookup.lookupToken,
  providerName: 'google',
  credentials: {
    token: '<google-id-token>',
    type: 'idToken',
  },
});
```

## Notes

- Token refresh is automatic when `autoRefresh` is enabled (default).
- In cookie mode, SDK sends requests with `credentials: include`.
- `tenantId` can be configured globally in client config or passed per request DTO.
- SDK defaults use `/auth/login/*` endpoints (legacy `/auth/identifier/*` aliases still work).
