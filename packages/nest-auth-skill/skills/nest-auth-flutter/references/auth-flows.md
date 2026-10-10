# Auth flows (Flutter)

`auth` is the `NestAuthController`; `auth.client` is the `NestAuthClient`. Controller methods update the UI state; client methods are the full API. Build the screens with the project's own widgets.

## Signup, login, logout

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<String?> signIn(NestAuthController auth, String email, String password) async {
  try {
    await auth.loginWithEmail(email, password); // status becomes authenticated, user is loaded
    return null;
  } on NestAuthException catch (e) {
    return e.message; // e.code: INVALID_CREDENTIALS, ACCOUNT_INACTIVE, RATE_LIMITED, ...
  }
}

Future<void> register(NestAuthController auth, String email, String password) =>
    auth.signup(email: email, password: password);

Future<void> signOut(NestAuthController auth) => auth.logout();
```

More control through the client (extra signup fields, phone login, a tenant):

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> registerWithProfile(NestAuthController auth, String email, String password) async {
  await auth.client.signup(
    email: email,
    password: password,
    extra: {'firstName': 'Ada'}, // sent to the backend's signup hooks
  );
  await auth.refreshUser(); // sync the controller after a direct client call
}

Future<AuthResponse> phoneLogin(NestAuthClient client, String phone, String password) =>
    client.login(providerName: 'phone', credentials: {'phone': phone, 'password': password});
```

After any direct `auth.client` call that signs the user in, call `auth.refreshUser()` so the controller's `status` and `user` update.

If the backend may require MFA, log in through the client instead of the controller: see `mfa.md`.

## Email / phone verification

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> sendEmailCode(NestAuthClient client) => client.sendEmailVerification();

Future<void> confirmEmail(NestAuthClient client, String code) => client.verifyEmail(code: code);
```

Phone: `sendPhoneVerification()` / `verifyPhone(code: ...)`.

## Forgot / reset password

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> requestReset(NestAuthClient client, String email) => client.forgotPassword(email: email);

Future<void> finishReset(NestAuthClient client, String email, String code, String newPassword) async {
  final result = await client.verifyForgotPasswordOtp(email: email, code: code);
  final token = (result['resetToken'] ?? result['token']) as String;
  await client.resetPassword(token: token, newPassword: newPassword);
}

Future<void> changePassword(NestAuthClient client, String current, String next) =>
    client.changePassword(currentPassword: current, newPassword: next);
```

The request step answers the same way whether or not the account exists; keep the message neutral. An invited user sets a first password with the same `resetPassword`, using the token from the invitation link (deep link).

## Passwordless (one-time code)

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> sendLoginCode(NestAuthClient client, String email) =>
    client.passwordlessSend(identifier: email, channel: 'email'); // or 'sms' with a phone number

Future<void> loginWithCode(NestAuthController auth, String email, String code) async {
  final res = await auth.client.passwordlessLogin(identifier: email, code: code, channel: 'email');
  if (!res.isRequiresMfa) await auth.refreshUser();
}
```

## Variations

- Magic link: open the app with a deep link carrying the identifier and code, then call `passwordlessLogin`.
- Tenant-scoped (ISOLATED backend): pass `tenantId:` to `signup`, `login`, `passwordlessSend`, `passwordlessLogin`, `verifyForgotPasswordOtp`. See `state-and-api.md`.
