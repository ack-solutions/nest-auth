# MFA (Flutter)

Needs `mfa.enabled` on the backend.

## The MFA step on login

Log in through the **client** so the response can be inspected. (`auth.loginWithEmail` loads the user straight away, which fails while MFA is pending.)

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

/// Returns true when a second step is needed.
Future<bool> startLogin(NestAuthController auth, String email, String password) async {
  final res = await auth.client.loginWithEmail(email, password);
  if (!res.isRequiresMfa) {
    await auth.refreshUser();
    return false;
  }
  // res.raw['mfaMethods'] lists what the user can use: 'totp', 'email', 'sms'
  return true;
}

/// Email or SMS code. Not needed for an authenticator app (TOTP).
Future<void> sendCode(NestAuthClient client, {bool sms = false}) =>
    client.sendMfaChallenge(method: sms ? 'phone' : 'email');

Future<void> finishLogin(NestAuthController auth, String otp, {String? method, bool trustDevice = false}) async {
  await auth.client.verifyMfa(otp: otp, method: method, trustDevice: trustDevice);
  await auth.refreshUser(); // now signed in
}

/// Lost device: a recovery code completes the login and keeps MFA on.
Future<void> finishWithRecoveryCode(NestAuthController auth, String code) async {
  await auth.client.verifyRecoveryCode(code: code);
  await auth.refreshUser();
}
```

`method` is `'totp'`, `'email'` or `'sms'`. `trustDevice: true` skips MFA on this device for the period the backend allows.

## Status and enrolment

`client.getMfaStatus()` returns the user's MFA state as a map.

Authenticator enrolment, toggling MFA and recovery-code generation have no dedicated Dart methods. Two supported options:

- Do enrolment in the web app or account portal, and only the login step in Flutter.
- Call the endpoints directly (`POST /auth/mfa/setup-totp`, `verify-totp-setup`, `toggle`, `generate-recovery-code`) with the access token: see `state-and-api.md` for authenticated requests and `rest-api.md` for the bodies.

## Variations

- One method only: skip the picker.
- MFA mandatory on the backend: route users without a method to enrolment after login.
