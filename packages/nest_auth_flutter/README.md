# nest_auth_flutter

Flutter / Dart SDK for [`@ackplus/nest-auth`](https://github.com/ack-solutions/nest-auth).

A small, dependency-light client: HTTP auth flows, secure token storage, and transparent token refresh. The core (`NestAuthClient`) is pure Dart; `SecureTokenStorage` wraps `flutter_secure_storage` for production apps.

## Install

```yaml
# pubspec.yaml
dependencies:
  nest_auth_flutter: ^2.0.0
```

## Backend setup

Run your nest-auth backend in **header token mode** so tokens come back in the response body:

```ts
NestAuthModule.forRoot({
  session: { jwt: { secret: env.JWT_SECRET }, accessTokenType: 'header' },
});
```

## Quick start

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

final auth = NestAuthClient(
  baseUrl: 'https://api.example.com',
  storage: SecureTokenStorage(), // keychain/keystore-backed
);

// Sign up or log in — tokens are persisted automatically.
await auth.signup(email: 'a@b.com', password: 'secret');
// or
await auth.loginWithEmail('a@b.com', 'secret');

if (await auth.isAuthenticated) {
  final user = await auth.getSessionUserData();
  print(user.email);
}

await auth.logout();
```

`NestAuthClient` attaches the access token to authenticated requests and, on a `401`, transparently refreshes once and retries.

## API

| Member | Description |
| --- | --- |
| `NestAuthClient(baseUrl:, storage:, httpClient:)` | Create a client. `storage` defaults to `InMemoryTokenStorage`. |
| `signup({email, phone, password, tenantId, extra})` | Register; persists tokens. |
| `login({providerName, credentials, ...})` / `loginWithEmail(email, password)` | Log in; persists tokens. |
| `socialLogin(provider, token, {type})` | Social login with a provider token you obtained natively. |
| `getSessionUserData()` | `GET /auth/me` → `SessionUser`. |
| `refresh()` | Exchange the refresh token → `TokenPair?`. |
| `logout()` | Revoke server-side (best effort) + clear local tokens. |
| `isAuthenticated` / `accessToken` | Current auth state. |

### Token storage

- `SecureTokenStorage` — `flutter_secure_storage` (keychain / keystore). Recommended.
- `InMemoryTokenStorage` — ephemeral; good for tests.
- Implement `TokenStorage` to back the client with anything else.

## Errors

Non-2xx responses throw `NestAuthException` with `statusCode`, `message`, and `code` (matching the backend's error envelope).

## Testing

This package ships a real, no-mock test suite: it spawns a live nest-auth backend (sqljs) and drives signup → login → refresh → logout over HTTP.

```bash
flutter test
```

## License

MIT
