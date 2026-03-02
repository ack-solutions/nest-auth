# @ackplus/nest-auth-react

React SDK for `@ackplus/nest-auth` built on top of `@ackplus/nest-auth-client`.

## Installation

```bash
npm install @ackplus/nest-auth-react @ackplus/nest-auth-client
# or
pnpm add @ackplus/nest-auth-react @ackplus/nest-auth-client
```

## Quick Start

```tsx
import React from 'react';
import { AuthClient } from '@ackplus/nest-auth-client';
import { AuthProvider, useNestAuth } from '@ackplus/nest-auth-react';

const client = new AuthClient({
  baseUrl: 'http://localhost:3000',
  accessTokenType: 'header',
});

function LoginButton() {
  const { login } = useNestAuth();

  return (
    <button
      onClick={() =>
        login({
          providerName: 'email',
          credentials: {
            email: 'user@example.com',
            password: 'SecurePass123!',
          },
        })
      }
    >
      Login
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider client={client}>
      <LoginButton />
    </AuthProvider>
  );
}
```

## Login Lookup in React

```tsx
const {
  identifierLookup,
  identifierPasswordLogin,
  identifierOtpChallenge,
  identifierOtpVerify,
  identifierMagicLinkChallenge,
  identifierMagicLinkVerify,
  identifierSocialLogin,
} = useNestAuth();

const lookup = await identifierLookup({ identifier: 'user@example.com' });
await identifierPasswordLogin({
  lookupToken: lookup.lookupToken,
  password: 'SecurePass123!',
});
```

Methods are named `identifier*` for compatibility, but default API routes are `/auth/login/*`.

## Next.js Helpers

This package also exports `createNextAuthHelpers` and `NextAuthProvider` for App Router usage.
