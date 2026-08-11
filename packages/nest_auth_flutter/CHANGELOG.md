# Changelog

## 2.10.0

- **Added `verifyRecoveryCode({ code, trustDevice })`** on `NestAuthClient` — redeem
  an MFA recovery (backup) code to complete a sign-in (MFA stays enabled). Persists tokens.

## 2.9.2

- No Flutter SDK changes — lockstep release with the backend MFA config fix (`@ackplus/nest-auth` 2.9.2).

## 2.9.1

- No Flutter SDK changes — lockstep release with the backend MFA hardening patch (`@ackplus/nest-auth` 2.9.1).

## 2.9.0

- No behavior change: `refresh()` already leaves stored tokens intact when it
  fails (a `502` or a `SocketException` throws without clearing tokens; only a
  definitive server rejection ends a session). Added a regression test that pins
  this so it can never regress. Released in lockstep with the JS/TS SDKs, which
  received the corresponding fix.

## 2.0.0

Initial release of the Flutter / Dart SDK for `@ackplus/nest-auth`.

- `NestAuthClient` — header-token mode HTTP client with transparent 401
  refresh-and-retry.
- Full auth surface: signup, email/password login, passwordless, social login,
  logout, refresh; password reset, change password; email & phone verification;
  switch tenant; MFA challenge/verify/status.
- Token storage: `TokenStorage` interface with `InMemoryTokenStorage` and
  `SecureTokenStorage` (backed by `flutter_secure_storage`).
- `NestAuthController` — a `ChangeNotifier` for reactive UIs.
- Typed models (`AuthResponse`, `SessionUser`, `TokenPair`) and
  `NestAuthException`.
