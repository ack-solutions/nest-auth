# @ackplus/nest-auth-react-native

React Native / Expo SDK for [`@ackplus/nest-auth`](https://github.com/ack-solutions/nest-auth).

It adds the two things React Native needs on top of the React SDK:

1. **Native token storage** — `AsyncStorageAdapter` and `SecureStoreAdapter` so sessions survive app restarts.
2. **A header-mode client factory** — RN can't use http-only cookies, so tokens are sent in the `Authorization` header and persisted to your storage adapter.

The provider, hooks, and guards from [`@ackplus/nest-auth-react`](../nest-auth-react) are re-exported and run unchanged on RN (their web-only code paths are feature-detected). Next.js helpers are intentionally **not** re-exported.

## Install

```bash
npm install @ackplus/nest-auth-react-native @ackplus/nest-auth-react @ackplus/nest-auth-client react
# pick a storage backend:
npm install @react-native-async-storage/async-storage   # Bare RN / Expo
# or
npx expo install expo-secure-store                       # Expo, keychain-backed
```

This package never imports the native storage module directly — you pass it in — so it stays dependency-light and testable.

## Quick start

```tsx
// auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNestAuthClient, AsyncStorageAdapter } from '@ackplus/nest-auth-react-native';

export const authClient = createNestAuthClient({
  baseUrl: 'https://api.example.com',
  storage: new AsyncStorageAdapter(AsyncStorage),
});
```

```tsx
// App.tsx
import { AuthProvider } from '@ackplus/nest-auth-react-native';
import { authClient } from './auth';

export default function App() {
  return (
    <AuthProvider client={authClient}>
      <RootNavigator />
    </AuthProvider>
  );
}
```

```tsx
// LoginScreen.tsx
import { useNestAuth } from '@ackplus/nest-auth-react-native';

export function LoginScreen() {
  const { login, sessionData, isAuthenticated } = useNestAuth();

  const onSubmit = async (email: string, password: string) => {
    await login({ providerName: 'email', credentials: { email, password } });
  };

  if (isAuthenticated) return <Text>Welcome, {sessionData?.email}</Text>;
  // ...render your form, call onSubmit
}
```

### Secure storage (recommended for production)

```ts
import * as SecureStore from 'expo-secure-store';
import { createNestAuthClient, SecureStoreAdapter } from '@ackplus/nest-auth-react-native';

export const authClient = createNestAuthClient({
  baseUrl: 'https://api.example.com',
  storage: new SecureStoreAdapter(SecureStore),
});
```

## Backend setup

Your nest-auth backend should run in **header token mode** so tokens are returned in the response body:

```ts
NestAuthModule.forRoot({
  session: { jwt: { secret: env.JWT_SECRET }, accessTokenType: 'header' },
  // ...
});
```

## API

| Export | Purpose |
| --- | --- |
| `createNestAuthClient(config)` | Build a header-mode `AuthClient` with required `storage`. |
| `AsyncStorageAdapter(storage, prefix?)` | `StorageAdapter` over AsyncStorage (or any compatible store). |
| `SecureStoreAdapter(store, prefix?)` | `StorageAdapter` over Expo SecureStore. |
| `AuthProvider`, `useNestAuth`, `useUser`, `useSession`, `useAccessToken`, `useAuthStatus`, `useHasRole`, `useHasPermission`, `useAuthHeaderFn` | Re-exported from the React SDK. |
| `AuthGuard`, `GuestGuard`, `RequireRole`, `RequirePermission` | Conditional-render guards. |
| `AuthClient`, `hasRole`, `hasPermission`, … + all `@ackplus/nest-auth-contracts` types | Re-exported from the core client. |

## Social login

Acquire the provider token natively (e.g. `@react-native-google-signin/google-signin`, Apple authentication) and pass it to `authClient.socialLogin(provider, token, opts)`.

## Testing

This package ships a real, no-mock E2E suite: it spawns a real nest-auth backend and drives the client through signup → login → refresh → logout over HTTP.

```bash
pnpm -F @ackplus/nest-auth-react-native test
```

## License

MIT
