# Setup (Flutter)

## Dependency

```yaml
dependencies:
  nest_auth_flutter: ^2.0.0
```

Or `flutter pub add nest_auth_flutter`. `SecureTokenStorage` uses `flutter_secure_storage`, which comes with the package; follow that plugin's platform notes (Android `minSdkVersion`, iOS keychain) if the build complains.

## Client and controller

Create them once and share them (a top-level variable, `provider`, a Riverpod provider, `get_it` — whatever the project uses).

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

final authClient = NestAuthClient(
  baseUrl: 'https://api.example.com', // origin + any global prefix, from the project's config
  storage: SecureTokenStorage(),      // tokens survive app restarts
);

final auth = NestAuthController(authClient);
```

- `storage` defaults to `InMemoryTokenStorage` (signed out on restart; fine for tests). `SecureTokenStorage(prefix: 'myapp.')` changes the key prefix. Implement `TokenStorage` (`read`, `write`, `delete`) for anything else.
- `httpClient:` accepts your own `http.Client`.

## Restore the session and gate the app

```dart
import 'package:flutter/material.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.auth, required this.home, required this.login});

  final NestAuthController auth;
  final Widget home;
  final Widget login;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    widget.auth.restore(); // loads the user if stored tokens are still valid
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.auth,
      builder: (context, _) {
        switch (widget.auth.status) {
          case AuthStatus.unknown:
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          case AuthStatus.authenticated:
            return widget.home;
          case AuthStatus.unauthenticated:
            return widget.login;
        }
      },
    );
  }
}
```

The controller exposes `status`, `user`, `isAuthenticated`, `isBusy`, `lastError`, and `client`.

## Other ways to gate navigation

- **go_router:** pass `refreshListenable: auth` and return `/login` from `redirect` when `auth.status` is `AuthStatus.unauthenticated`.
- **Riverpod / Bloc / GetX:** wrap the client or controller in the project's own state object; see `state-and-api.md`.
- **No controller:** `await authClient.isAuthenticated` and `authClient.getSessionUserData()` are enough for a simple app.

## What the backend must provide

Server settings, not app code; tell the user if one is missing.

- Header token mode available (not forced to cookies).
- The login methods the app offers, enabled in the backend options.
- A URL the device can reach. Plain `http://` needs a cleartext exception on Android and an ATS exception on iOS; prefer HTTPS.
