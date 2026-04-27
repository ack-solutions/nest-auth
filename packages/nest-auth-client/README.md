# @ackplus/nest-auth-client

[![npm version](https://img.shields.io/npm/v/@ackplus/nest-auth-client.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-client)
[![npm downloads](https://img.shields.io/npm/dm/@ackplus/nest-auth-client.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-client)
[![license](https://img.shields.io/npm/l/@ackplus/nest-auth-client.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-client)

Framework-agnostic JavaScript/TypeScript client for [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth). Zero peer dependencies. Works anywhere modern JS runs — browsers, Node 18+, React Native, Cloudflare Workers, Deno, Bun.

> 📚 **Full documentation: [ack-solutions.github.io/nest-auth/docs/client](https://ack-solutions.github.io/nest-auth/docs/client/)**

---

## Why use it

The official client for the `@ackplus/nest-auth` backend. Use it directly from Vue, Angular, Svelte, vanilla JS, or as the foundation under [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react).

It handles the parts of auth that are tedious to write by hand: token persistence, automatic refresh on 401 with concurrent-request deduplication, cookie/header mode switching, MFA flows, multi-tenant context, and an event subscription API.

## Install

```bash
pnpm add @ackplus/nest-auth-client
```

**No peer dependencies.** TypeScript definitions ship in the package.

## Minimal example

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

const auth = new AuthClient({
  baseUrl: 'https://api.example.com',
});

await auth.signup({
  email: 'alice@example.com',
  password: 'correct horse battery staple',
  firstName: 'Alice',     // any extra field flows through to UserRegisteredEvent
});

await auth.login({
  credentials: { email: 'alice@example.com', password: 'correct horse battery staple' },
});

if (auth.getIsAuthenticated()) {
  const user = await auth.getSessionUserData();
  console.log('Hello', user.email);
}
```

## What's included

| Capability | Notes |
| --- | --- |
| **Auth flows** | `signup`, `login`, `logout`, `logoutAll`, `refresh`, `passwordlessSend`, `switchTenant` |
| **MFA** | `send2fa`, `verify2fa`, `setupTotp`, `verifyTotpSetup`, `getMfaStatus`, recovery codes |
| **Password management** | `forgotPassword`, `verifyForgotPasswordOtp`, `resetPassword`, `changePassword` |
| **Email/phone verification** | `sendEmailVerification`, `verifyEmail`, `sendPhoneVerification`, `verifyPhone` |
| **Auto-refresh** | 401 → refresh → retry once, with `RefreshQueue` deduplication so N parallel 401s only fire **one** refresh |
| **Header or cookie mode** | `accessTokenType: 'header' \| 'cookie' \| null` (auto-detect) |
| **Storage adapters** | `MemoryStorage`, `LocalStorageAdapter`, `SessionStorageAdapter`, `CookieStorageAdapter`, custom |
| **HTTP adapters** | `FetchAdapter` (default) or `createAxiosAdapter(yourAxiosInstance)`, custom |
| **Events** | `onTokensSet`, `onTokenRefreshed`, `onTokensRemoved`, `onLogout`, `onError`, `onSessionVerified` |
| **Utilities** | `decodeJwt`, `isTokenExpired`, `hasRole`, `hasPermission`, `hasAnyAccess`, `hasAllAccess` |

## Configuration

```ts
new AuthClient({
  baseUrl: 'https://api.example.com',
  storage: new LocalStorageAdapter('myapp_'),
  httpAdapter: new FetchAdapter(),
  accessTokenType: 'header',     // or 'cookie' or null (auto-detect)
  autoRefresh: true,
  refreshThreshold: 60,          // seconds before expiry
  onTokenRefreshed: (tokens) => { /* … */ },
  onLogout: () => { window.location.href = '/login'; },
  onError: (err) => console.error(err),
});
```

[Full config reference →](https://ack-solutions.github.io/nest-auth/docs/client/config/)

## React Native

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthClient, type StorageAdapter } from '@ackplus/nest-auth-client';

const RNStorage: StorageAdapter = {
  get:    (k) => AsyncStorage.getItem(k),
  set:    (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
  clear:  () => AsyncStorage.clear(),
};

export const auth = new AuthClient({
  baseUrl: 'https://api.example.com',
  storage: RNStorage,
});
```

## Documentation

| Section | What's there |
| --- | --- |
| [`AuthClient`](https://ack-solutions.github.io/nest-auth/docs/client/client/) | Every method with TS signatures and examples |
| [Config](https://ack-solutions.github.io/nest-auth/docs/client/config/) | All `AuthClientConfig` options |
| [Storage Adapters](https://ack-solutions.github.io/nest-auth/docs/client/storage-adapters/) | Built-ins and how to write your own |
| [HTTP Adapters](https://ack-solutions.github.io/nest-auth/docs/client/http-adapters/) | Fetch (default), axios, custom |
| [Events](https://ack-solutions.github.io/nest-auth/docs/client/events/) | Subscription API |
| [Utilities](https://ack-solutions.github.io/nest-auth/docs/client/utilities/) | JWT helpers, role/permission checks |

## Companion packages

| Package | Use when |
| --- | --- |
| [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth) | The NestJS backend module |
| [`@ackplus/nest-auth-react`](https://www.npmjs.com/package/@ackplus/nest-auth-react) | React provider, hooks, guards, and Next.js App Router helpers (recommended for React) |
| [`@ackplus/nest-auth-contracts`](https://www.npmjs.com/package/@ackplus/nest-auth-contracts) | Shared TS types (already a transitive dep of this package) |

All four packages release together with the same version number. Pin them all to the same version.

## Links

- 📚 [Documentation](https://ack-solutions.github.io/nest-auth/)
- 💬 [Issue Tracker](https://github.com/ack-solutions/nest-auth/issues)
- 📦 [GitHub Repository](https://github.com/ack-solutions/nest-auth)

## License

[MIT](https://github.com/ack-solutions/nest-auth/blob/main/LICENSE)
