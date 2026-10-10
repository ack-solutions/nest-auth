# State, roles, your own API, tenants, errors (Flutter)

## State management

`NestAuthController` is a plain `ChangeNotifier`, so it plugs into anything.

```dart
import 'package:flutter/material.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

// Plain Flutter: rebuild part of the tree when auth changes.
Widget accountLabel(NestAuthController auth) => ListenableBuilder(
      listenable: auth,
      builder: (context, _) => Text(auth.user?.email ?? 'Signed out'),
    );
```

- **provider:** `ChangeNotifierProvider.value(value: auth)` and `context.watch<NestAuthController>()`.
- **Riverpod:** `ChangeNotifierProvider((ref) => auth)`, or a `Notifier` that calls the client.
- **Bloc / GetX / MobX:** keep the project's pattern and call `NestAuthClient` from it. The controller is optional.

## Roles and permissions in the UI

The session user's extra fields are in `user.raw`.

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

bool hasPermission(SessionUser? user, String permission) {
  final list = (user?.raw['permissions'] as List?) ?? const [];
  return list.contains(permission);
}

bool hasRole(SessionUser? user, String role) {
  final roles = (user?.raw['roles'] as List?) ?? const [];
  return roles.any((r) => r is Map && r['name'] == role);
}
```

These hide or show widgets; the backend enforces access. Call `auth.refreshUser()` to pick up role changes.

## Calling the app's own API

`NestAuthClient` signs its own auth calls. For the app's other endpoints, add the token with whatever HTTP client the project uses.

```dart
import 'package:http/http.dart' as http;
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<http.Response> authedGet(NestAuthClient client, Uri url) async {
  Future<http.Response> send() async {
    final token = await client.accessToken;
    return http.get(url, headers: {if (token != null) 'Authorization': 'Bearer $token'});
  }

  var res = await send();
  if (res.statusCode == 401 && await client.refresh() != null) {
    res = await send(); // retry once with the new token
  }
  return res;
}
```

With Dio, do the same in an interceptor: set the header in `onRequest`, and in `onError` for a 401 call `client.refresh()` and retry once.

## Tenants

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

// SHARED backend: switch the active tenant without signing in again.
Future<void> switchTenant(NestAuthController auth, String tenantId) async {
  await auth.client.switchTenant(tenantId);
  await auth.refreshUser(); // roles for the new tenant
}

// ISOLATED backend: the tenant is chosen before login.
Future<void> tenantLogin(NestAuthController auth, String tenantId, String email, String password) async {
  final res = await auth.client.login(
    credentials: {'email': email, 'password': password},
    tenantId: tenantId,
  );
  if (!res.isRequiresMfa) await auth.refreshUser();
}
```

Resolve a tenant from a slug with the public endpoint `GET /auth/tenants/lookup?slug=...` (see `rest-api.md`).

## Errors

Failed calls throw `NestAuthException` with `statusCode`, `message`, `code` and `body`. Branch on `code`, show `message`. The controller also keeps the last failure in `auth.lastError` and rethrows.

A failed request is not always a logout: only treat the user as signed out when `refresh()` returns null or the status is 401 after a retry. Network errors should leave the session alone.

## Lifecycle

`auth.restore()` on app start; `auth.logout()` clears tokens even if the server call fails; `authClient.close()` releases the HTTP client when the app shuts down (rarely needed).
