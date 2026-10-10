# React Native / Expo

React Native uses **header mode**: tokens are stored on the device and sent in `Authorization`. The backend should leave `session.accessTokenType` unset or set it to `'header'` (a backend forced to `'cookie'` cannot serve native apps).

## Install

```bash
npm i @ackplus/nest-auth-react-native @ackplus/nest-auth-react @ackplus/nest-auth-client
npx expo install expo-secure-store        # or: npm i @react-native-async-storage/async-storage
```

The storage module is passed in; the SDK does not import it.

```tsx nocheck
// auth.ts
import * as SecureStore from 'expo-secure-store';
import { createNestAuthClient, SecureStoreAdapter } from '@ackplus/nest-auth-react-native';

export const authClient = createNestAuthClient({
  baseUrl: 'https://api.example.com',
  storage: new SecureStoreAdapter(SecureStore), // or new AsyncStorageAdapter(AsyncStorage)
});

// App.tsx
import { AuthProvider } from '@ackplus/nest-auth-react-native';

export default function App() {
  return (
    <AuthProvider client={authClient}>
      <RootNavigator />
    </AuthProvider>
  );
}
```

- Storage: `SecureStoreAdapter` (keychain/keystore, recommended), `AsyncStorageAdapter`, or any object implementing `StorageAdapter` (MMKV, for example).
- `AuthProvider`, `useNestAuth`, `useUser`, `AuthGuard` and the other hooks/guards from `setup.md` and `guards-and-roles.md` are re-exported from `@ackplus/nest-auth-react-native` and work the same. Import them from there, not from the web package. Next.js helpers are not available.
- Use a device-reachable `baseUrl` in development (not `localhost` on a physical device).

### Native social sign-in

The native module is injected too.

```tsx nocheck
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '@ackplus/nest-auth-react-native';

GoogleSignin.configure({ webClientId: 'WEB_CLIENT_ID.apps.googleusercontent.com' });
await signInWithGoogle(authClient, GoogleSignin);
```

`webClientId` must be the backend's `google.clientId` (or listed in `google.audiences`). Apple: `signInWithApple(authClient, AppleAuthentication)` with `expo-apple-authentication`; the backend's `apple.audiences` must include the iOS bundle ID.

## Notes

- The login, MFA, reset and tenancy flows are the same hook calls as on the web: see `auth-flows.md`, `mfa.md`, `tenancy.md`.
- For an endpoint the SDK does not wrap, see `rest-api.md`.
- Flutter apps have their own skill, `nest-auth-flutter`.
