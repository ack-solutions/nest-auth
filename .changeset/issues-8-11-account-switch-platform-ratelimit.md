---
"@ackplus/nest-auth": minor
"@ackplus/nest-auth-client": minor
"@ackplus/nest-auth-react": patch
---

Fixes for issues #8, #9, #10 and #11.

- **`AuthProvider` no longer shows the previous account after a `client` change (#8).** Switching accounts by swapping the `client` prop now clears `sessionData` and `session` and resets `status` to `'loading'` synchronously, so no render shows the old account's permissions. Late results from the old client (a slow `/auth/me`, a token refresh) are dropped. If the new account can't be verified during an outage, the provider fails closed to `'unknown'` with no permissions instead of keeping the old account's `'authenticated'`.
- **`IAccountSwitcher` declares `createPendingClient?()` and `discardPendingClient?(client)` (#9),** so the add-account flow type-checks through `useAccountSwitcher().manager` without a cast. Both are optional because `CookieAccountManager` doesn't implement them.
- **New `adminConsole.allowPlatformUserManagement` (default `true`) (#10).** Set it to `false` to keep platform (super-admin) users out of the bundled console: creating a platform user, granting or revoking platform access and setting platform roles answer `403 PLATFORM_USER_MANAGEMENT_DISABLED`, and existing platform users are read-only there (editing, deleting or removing their MFA device is refused). The console hides those controls; tenant users, sessions and roles stay manageable.
- **App-defined rate-limit buckets (#11).** `security.rateLimit.buckets` accepts any name (with `windowMs` and `max`), and `@RateLimit` accepts those names, each with its own counter. A `@RateLimit` naming a bucket that is neither built-in nor configured now fails at boot. Previously such a name left the route unthrottled without an error. Built-in bucket overrides may now be partial (for example `{ max: 10 }` keeps the default window).
