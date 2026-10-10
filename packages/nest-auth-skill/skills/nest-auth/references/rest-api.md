# REST API (using Nest Auth without an SDK)

The SDKs are thin wrappers over a normal JSON API. Any language or HTTP client can call it. Use this when the project has no supported SDK, already has its own API layer, or the user prefers direct calls.

Base path: `<origin>/<app global prefix>/auth`. `auth` can be changed with `routePrefix`. A machine-readable spec is in the docs: https://ack-solutions.github.io/nest-auth/docs/api-reference

## Token transport

Send `x-access-token-type: header` or `x-access-token-type: cookie` on auth requests to choose the mode (ignored if the backend forces one with `session.accessTokenType`).

- **header**: login responds with `{ accessToken, refreshToken }`. Send `Authorization: Bearer <accessToken>`. Refresh with `POST /auth/refresh-token { refreshToken }` and store the new pair (refresh tokens rotate; a reused one is rejected).
- **cookie**: login sets http-only `accessToken` and `refreshToken` cookies. Send requests with credentials. Refresh with `POST /auth/refresh-token` and no body.
- **API key**: `Authorization: ApiKey <publicKey>.<privateKey>`.

A 401 on a protected call means: refresh once, retry once, and only then treat the user as signed out.

## Endpoints

| Method and path | Body | Notes |
|---|---|---|
| `POST /auth/signup` | `{ email? , phone?, password, tenantId?, ...extra }` | |
| `POST /auth/login` | `{ providerName, credentials, tenantId?, rememberMe?, createUserIfNotExists? }` | see below |
| `POST /auth/logout`, `POST /auth/logout-all` | — | |
| `POST /auth/refresh-token` | `{ refreshToken }` in header mode | |
| `GET /auth/me` | — | user + roles + permissions |
| `GET /auth/verify-session` | — | `{ valid, userId, expiresAt }` |
| `GET /auth/client-config` | — | public: what the backend has enabled |
| `POST /auth/passwordless/send` | `{ identifier, channel: 'email' \| 'sms', tenantId? }` | then login with `providerName: 'passwordless'` |
| `POST /auth/forgot-password` | `{ email? , phone? }` | |
| `POST /auth/verify-forgot-password-otp` | `{ email? , phone?, code }` | returns `resetToken` |
| `POST /auth/reset-password` | `{ token, newPassword }` | |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` | |
| `POST /auth/send-email-verification`, `POST /auth/verify-email` | `{ code }` on verify | phone: `send-phone-verification`, `verify-phone` |
| `POST /auth/mfa/challenge` | `{ method }` | send an email/SMS code |
| `POST /auth/mfa/verify` | `{ otp, method?, trustDevice? }` | completes an MFA login |
| `POST /auth/mfa/verify-recovery-code` | `{ code }` | |
| `GET /auth/mfa/status`, `POST /auth/mfa/setup-totp`, `POST /auth/mfa/verify-totp-setup`, `POST /auth/mfa/toggle`, `GET/DELETE /auth/mfa/devices`, `POST /auth/mfa/generate-recovery-code` | | enrolment and management |
| `POST /auth/switch-tenant` | `{ tenantId }` | SHARED tenancy |
| `GET /auth/tenants/lookup?slug=` | — | public: slug → `{ id, slug, name }` |
| `POST /auth/invite` | `{ email? , phone?, tenantId?, metadata? }` | needs the `users.invite` permission |

Login `credentials` by `providerName`:

```json
{ "providerName": "email", "credentials": { "email": "a@b.com", "password": "..." } }
{ "providerName": "phone", "credentials": { "phone": "+15551234567", "password": "..." } }
{ "providerName": "google", "credentials": { "token": "<id token>", "type": "idToken" }, "createUserIfNotExists": true }
{ "providerName": "passwordless", "credentials": { "identifier": "a@b.com", "code": "123456", "channels": ["email"] } }
```

`createUserIfNotExists` defaults to `false`: a social login for an unknown user is rejected unless it is `true`.

A login response with `isRequiresMfa: true` is not finished: call `mfa/verify` with the same session before using protected routes.

## Errors

Non-2xx responses are `{ statusCode, message, code }` (plus any extra fields the handler attached). `message` is a single string. Branch on `code`, for example `INVALID_CREDENTIALS`, `MFA_REQUIRED`, `ACCOUNT_INACTIVE`, `RATE_LIMITED`.

## When the SDK is still worth it

The JS client already implements token storage, refresh with a single-flight queue, retry-once on 401, and the "only 401/403 ends a session" rule. If you call the API by hand, implement those four things.
