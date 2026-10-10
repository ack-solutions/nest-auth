# Configuration reference

Every top-level option of `NestAuthModule.forRoot(options)` / `forRootAsync`. Only `appName` and `session.jwt.secret` are required; everything else has a default. Set only what the request needs. The exact shape of each option is in the installed types (`IAuthModuleOptions`).

| Option | Default | What it does | Details in |
|---|---|---|---|
| `appName` | — (required) | Display name; shown in authenticator apps | `backend-setup.md` |
| `isGlobal` | `true` | Registers the module globally | `backend-setup.md` |
| `routePrefix` | `'auth'` | Base path of all auth routes (`forRoot` only) | `rest-api.md` |
| `session` | DB store, 1h access / 30d refresh | JWT secret, token transport, lifetimes, store, cookies, session hooks | `sessions-tokens.md` |
| `enableAutoRefresh` | `true` | Server-side interceptor that renews an expired access token when a valid refresh token comes with the request | `sessions-tokens.md` |
| `emailAuth` | enabled | Email + password; `disposable` email blocking | `email-password.md`, `security.md` |
| `phoneAuth` | disabled | Phone + password | `email-password.md` |
| `registration` | enabled | Public signup on/off, invitation-only, verified-email requirement, auto-login, profile fields | `email-password.md` |
| `password` | argon2, reset token 1h | Hashing (or custom `hash`/`verify`), policy, reset-token lifetime | `email-password.md`, `security.md` |
| `mustChangePassword` | surface only | `enforce: true` hard-blocks users with a temporary password | `email-password.md` |
| `otp` | 6 digits, 30m | Length, format, lifetime, attempts and generator for every code | `passwordless-otp.md` |
| `passwordless` | disabled | One-time-code login; `allowSignUp` | `passwordless-otp.md` |
| `google` `github` `facebook` `apple` | absent = off | Built-in social providers | `social-login.md` |
| `social` | verified email required for linking | Account-linking rules | `social-login.md` |
| `customAuthProviders` | none | Your own login providers | `social-login.md`, `advanced.md` |
| `mfa` | disabled | Methods, required, trusted devices, recovery codes | `mfa.md` |
| `tenant` | disabled | Multi-tenancy and its mode | `multi-tenancy.md` |
| `roleGuards` | `['web']` | Allowed role namespaces | `roles-permissions.md` |
| `authorization` | DB roles, live refresh 30s | Custom role/permission resolvers, `liveSessionRoles` | `roles-permissions.md` |
| `platformAccess` | disabled | Cross-tenant super-admins | `advanced.md` |
| `accessKeys` | enabled | API-key authentication on/off | `security.md` |
| `security` | all off | `rateLimit`, `lockout`, `captcha`, `csrf` | `security.md` |
| `audit` | off | `onEvent` callback for auth audit events | `security.md` |
| `adminConsole` | **enabled** | Embedded admin dashboard | `advanced.md` |
| `user` `auth` `registrationHooks` `loginHooks` `guards` | none | Hooks into the auth flow | `advanced.md` |
| `clientConfig` | built-in | `factory` to change what `GET /auth/client-config` returns | `advanced.md` |
| `resolveConfig` | none | Per-request option overrides (by domain, client type, tenant) | `advanced.md` |
| `errorHandler` | none | Transform auth errors before they are returned | `advanced.md` |
| `debug` | off | Verbose library logging | `advanced.md` |

## Combining options

Options are independent. Any login method can be combined with any other (email + Google + passwordless), with or without MFA, tenancy or roles. The frontend can ask the backend what is enabled with `GET /auth/client-config` and render accordingly, so one UI can serve differently configured backends.
