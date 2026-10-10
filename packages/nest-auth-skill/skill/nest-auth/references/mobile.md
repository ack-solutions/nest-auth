# Mobile (React Native / Expo, Flutter)

Mobile clients use **header mode**: tokens are stored on the device and sent in `Authorization`. The backend must not force cookie mode (`session.accessTokenType` unset or `'header'`).

## React Native / Expo

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

- Prefer `SecureStoreAdapter` (keychain/keystore) for tokens.
- `AuthProvider`, `useNestAuth`, `useUser`, `AuthGuard` and the other hooks/guards from `react.md` are re-exported from `@ackplus/nest-auth-react-native` and work the same. Import them from there, not from the web package. Next.js helpers are not available.
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

## Flutter

```yaml
dependencies:
  nest_auth_flutter: ^2.0.0
```

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

final auth = NestAuthController(
  NestAuthClient(baseUrl: 'https://api.example.com', storage: SecureTokenStorage()),
);

await auth.restore();                         // on app start
await auth.loginWithEmail(email, password);   // or auth.signup(...)
await auth.logout();
```

- `NestAuthController` is a `ChangeNotifier` with `status`, `user`, `isAuthenticated`, `isBusy`, `lastError`. Rebuild with `ListenableBuilder` or the project's state library (provider, Riverpod).
- `NestAuthClient` has `signup`, `login`, `loginWithEmail`, `socialLogin(provider, token)`, `getSessionUserData`, `refresh`, `logout`. It refreshes once and retries on a 401.
- Errors throw `NestAuthException` with `statusCode`, `message`, `code`.
- Check the installed package's API for MFA and passwordless methods before using them; fall back to the documented REST endpoints (`/auth/mfa/verify`, `/auth/passwordless/send`) through the client's HTTP layer if a method is missing.
