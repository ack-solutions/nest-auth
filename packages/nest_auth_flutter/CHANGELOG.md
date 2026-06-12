# Changelog

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
