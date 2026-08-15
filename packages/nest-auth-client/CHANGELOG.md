# @ackplus/nest-auth-client

## 2.10.3

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-contracts@2.10.3

## 2.10.2

### Patch Changes

- fix(client): surface mustChangePassword on the multi-account sign-in snapshot

  The backend returns `mustChangePassword: true` on the login response and the single-account `AuthClient.login()` exposed it — but `AccountManager.addAccount()` resolved to an `AccountSnapshot` with no such field and discarded the login response. Any app running `allowMultipleAccounts: true` therefore had no way to learn from the sign-in call that the member was on an admin-issued temporary password, so forced-password-change prompts were dead in exactly the apps that use the switcher.
  - **`AccountSnapshot.mustChangePassword`** — set on the snapshot returned by `addAccount()` / `commitAccount()` (and so the React `addAccount` / `completeMfa`), in both `AccountManager` and `CookieAccountManager`.
  - Header mode reads it from the `/auth/me` lookup `commitAccount` **already performs**, so there is no extra round-trip, and the MFA-commit path — where the login response is no longer in hand — is covered too. The login response is kept as a fallback if that best-effort lookup fails.

  The flag is deliberately **one-shot**: it rides the returned snapshot only, is never written to the persisted account index, and never appears on `listAccounts()` snapshots. A cached `true` would outlive the password change and bounce the user back to the change-password screen forever. Re-check it later with `getSessionUserData()` (`GET /auth/me`), which is always current; `undefined` means "not observed here", not "false" — the backend `mustChangePassword.enforce` guard remains the actual enforcement.

  Additive only — no behaviour change for apps that don't read the new field.
  - @ackplus/nest-auth-contracts@2.10.2

## 2.10.1

### Patch Changes

- **Fixed — no doomed refresh request when there is no session.** In header mode,
  if there is no stored refresh token (a fresh visitor or cleared storage),
  `refresh()` no longer POSTs `/auth/refresh-token` with an empty body; it
  short-circuits to a **definitive `kind: 'rejected'`** error, so
  `verifySession()` resolves to `{ valid: false }` and the app shows login. This
  also makes it robust against an older backend that 400s a missing token (which
  the SDK would otherwise treat as indeterminate and hang on load). Pairs with the
  server-side 401 fix in `@ackplus/nest-auth@2.10.1`.
  - @ackplus/nest-auth-contracts@2.10.1

## 2.10.0

### Minor Changes

- **Added `verifyRecoveryCode({ code, trustDevice? })`** — redeem an MFA recovery
  (backup) code to complete a sign-in. Unlike `resetMfa`, MFA stays enabled and
  your factors are kept; the returned session is stored like `verify2fa`.
- `generateRecoveryCode()` now returns a **set**: `{ codes: string[], code }`
  (`code` = `codes[0]`, kept for backward compatibility).
  - @ackplus/nest-auth-contracts@2.10.0

## 2.9.2

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA config fix (see `@ackplus/nest-auth@2.9.2`).
  - @ackplus/nest-auth-contracts@2.9.2

## 2.9.1

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA hardening patch (see `@ackplus/nest-auth@2.9.1`).
  - @ackplus/nest-auth-contracts@2.9.1

## 2.9.0

### Minor Changes

- **Fixed — the SDK logged users out on network blips and server hiccups.**
  A session was being destroyed on any failed refresh/verify, not just a real
  rejection. `refresh()` called `logout()` (clearing tokens + emitting a logout
  event) on **every** non-2xx response — including the synthesised status `0` of
  a network failure, timeouts, `429`, and all `5xx`. `verifySession()` returned
  `{ valid: false }` for those same failures, making "we couldn't reach the
  server" indistinguishable from "the server said the session is invalid". Any
  connectivity blip or backend hiccup therefore logged the user out.

  **The rule now, everywhere:** a session may only be ended by a **definitive
  rejection** — the server answered refresh/verify with **401 (or 403)**.
  Everything else is **indeterminate**: tokens are preserved, no logout is
  emitted, and a **retryable** error is thrown.
  - `refresh()` clears auth state **only** on 401/403, and does so via
    `clearAuthState()` — not `logout()`, which would POST `/auth/logout` (a
    pointless round trip against a server that just rejected the session, and a
    doomed one when the failure was a network error). On indeterminate failures
    it clears nothing and throws.
  - `verifySession()` **throws** on an indeterminate failure (instead of
    returning `{ valid: false }`), and only returns `{ valid: false }` on a
    definitive 401/403. An expired access token backed by a live refresh token
    still verifies (it refreshes once, then re-checks).
  - Every thrown auth error now carries a discriminator so callers classify
    without re-deriving it from status codes: **`error.kind: 'rejected' |
'indeterminate'`** plus `error.statusCode`. New exports `classifyAuthFailure`
    and the `AuthFailureKind` type.
  - **Friendlier default messages.** When the server sends no message (network /
    timeout / opaque 5xx), errors now read like "Unable to reach the server.
    Check your internet connection and try again." instead of "An error
    occurred".

- **Breaking-ish (hence the minor bump):** `verifySession()` now **throws** on an
  indeterminate failure rather than resolving to `{ valid: false }`. Catch it and
  check `error.kind` — treat `'indeterminate'` as retryable, not logged-out.
  - @ackplus/nest-auth-contracts@2.9.0

## 2.8.0

### Minor Changes

- Social login accepts `firstName` / `lastName` / `avatarUrl` credential fields. Part of the 2.8.0 security-hardening release (see `@ackplus/nest-auth`).
- Updated dependencies
  - @ackplus/nest-auth-contracts@2.8.0

## 2.7.6

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.6

## 2.7.5

### Patch Changes

- feat(client): `IClientConfig` now includes passwordless, OAuth public ids,
  `platformAccess`, `accessTokenType`, and `customProviders` (canonical type
  lives in `@ackplus/nest-auth-contracts`).
  - @ackplus/nest-auth-contracts@2.7.5

## 2.7.4

### Patch Changes

- fix(client): no more silent anonymous requests when no account is active

  With no active account, `AccountManager.getAuthHeaders()` / `getAuthHeadersSync()` / `shouldSendCookies()` / `refresh()` resolved to nothing **silently** — so every request through an attached axios/fetch went out without an `Authorization` header and came back 401, while an `AuthProvider` fed a separate bootstrap client still reported the user as signed in. Two token sources disagreeing with no signal, and very hard to diagnose.
  - **`fallbackClient`** (new `AccountManagerConfig` option) — the client to fall back to when no account is active, typically your single-account bootstrap client.
  - **`resolveActiveClient()`** (new, also on `IAccountSwitcher`) — the client auth actually resolves through (active account, else `fallbackClient`). Feed this to your auth provider so it and your attached HTTP client can never diverge.
  - **`onNoActiveAccount({ method })`** (new option) — fires when auth resolves to nothing, so you can log/redirect instead of silently 401ing.

  Resolution is also **boot-safe**: the async resolvers await the account index before answering, and the sync ones return the neutral default until it has loaded, so a persisted active account is never briefly impersonated by the `fallbackClient`.

  Behaviour is unchanged when neither option is configured (still non-fatal empty headers, so genuinely public requests keep working). Note: the exported `IAccountSwitcher` interface gained `resolveActiveClient()` — custom in-house implementers (not users of the shipped managers) must add it.
  - @ackplus/nest-auth-contracts@2.7.4

## 2.7.3

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.3

## 2.7.2

### Patch Changes

- fix(client/react): reap orphaned per-account token namespaces + add reset() / discardPendingClient()

  `AccountManager` (header mode) could strand per-account token namespaces in storage (`<prefix>a_<uuid>_access_token` / `_refresh_token` / `_session`) forever: `removeAccount` can only target namespaces still in the index, so any namespace written but not (or no longer) indexed — an interrupted add-account, an abandoned MFA/OTP pending client, or an index/storage desync — leaked. Now:
  - **Automatic orphan GC** on `ready()` drops any `<prefix>a_<uuid>_*` namespace the account index no longer references, so the leak self-heals on the next boot. Needs a persistent storage adapter that exposes the new optional `StorageAdapter.keys()` (the built-in local/session/memory adapters implement it). Opt out with `reapOrphanStorageOnReady: false`. A corrupt/unparseable index never triggers destructive reaping.
  - **`reset()`** — remove every account, revoke each session server-side (best-effort), and wipe all per-account storage (added to `AccountManager`, `CookieAccountManager`, the `IAccountSwitcher` interface, and the React `useAccountSwitcher()`). Lets an app implement "a plain sign-in starts a fresh single-account session" without reverse-engineering storage keys.
  - **`discardPendingClient(client)`** — clear an abandoned `createPendingClient()` / `AccountMfaRequiredError` pending client so its tokens don't linger.

  Note: the exported `IAccountSwitcher` interface gained `reset()` — custom in-house implementers (not users of the shipped managers) must add it.
  - @ackplus/nest-auth-contracts@2.7.2

## 2.7.1

### Patch Changes

- fix(client): prevent a refresh deadlock when one axios is shared by AuthClient + attachToAxios

  Sharing a single axios instance for both `AuthClient` (`httpAdapter: createAxiosAdapter(api)`) and `attachToAxios(client, api)` could **deadlock on an expired session**: the boot `verifySession` 401 made the app interceptor start `refresh()`, and the refresh-token request went back through the same interceptor, so a nested `refresh()` parked on the refresh queue while the outer one awaited its own HTTP call. The app hung on the splash screen — tokens were never cleared and the router never redirected to login.
  - `createAxiosAdapter` now tags every request `AuthClient` makes, and `attachToAxios` skips those tagged requests — the app interceptor never re-handles `AuthClient`'s own auth traffic (which already manages its own 401 → refresh).
  - `attachToAxios` / `attachToFetch` now also default-skip the auth endpoints (`/auth/refresh-token`, `/auth/login`, `/auth/logout`, `/auth/logout-all`), so they are never bearer-injected or refresh-retried. Do login/logout via the `AuthClient`/`AccountManager` methods; if you renamed those endpoints, pass the custom paths in `skipPaths`.
  - Exposes the `NEST_AUTH_ADAPTER_REQUEST` marker for custom adapters that want the same opt-out.

  Sharing one instance is now safe, but two instances (a plain transport for `AuthClient` + a separate app instance with `attachToAxios` + `onRefreshFailed`) remains the recommended setup.
  - @ackplus/nest-auth-contracts@2.7.1

## 2.7.0

### Minor Changes

- feat: platform-user listing + passwordless login completion
  - **List platform users without scanning every tenant.** `UserService` gains
    `getPlatformUsers(options?)`, `getPlatformUsersAndCount(options?)`, and
    `getPlatformUsersByRole(roleName, guard?)` — the list analog of
    `getPlatformUserByEmail`. They scope to the `NestAuthPlatformAccess` marker
    (caller `where`/`relations`/`skip`/`take`/`order` are honored), so an admin
    "Platform Users" screen no longer has to fetch all users and filter client-side.
  - **Complete a passwordless sign-in from the client.** `AuthClient.passwordlessLogin(dto)`
    and the React `useNestAuth().passwordlessLogin(dto)` exchange the emailed/texted
    code for a session (the completion step for `passwordlessSend`), returning a
    normal auth response. New `IPasswordlessLoginRequest` type (`{ identifier, code,
channel?, tenantId?, rememberMe? }`); `channel` defaults to trying both email and
    SMS. Wraps `POST /auth/login` with the existing passwordless provider — no backend
    change.

  Both additions are backward-compatible (new methods/types only). React Native
  consumers get `passwordlessLogin` for free via the shared `AuthClient`.

### Patch Changes

- @ackplus/nest-auth-contracts@2.7.0

## 2.6.0

### Minor Changes

- feat(client/react): multi-account switcher DX — provider-aware attach, account naming, MFA-on-add, add-account guard

  Closes four gaps building an instant account switcher on `AccountManager` / `AccountSwitcherProvider`:
  - **Attach to the manager, not one client.** `attachToAxios` / `attachToFetch` now accept any `AuthHeaderProvider` — including `AccountManager` / `CookieAccountManager` — and the managers expose instance `attachToAxios()` / `attachToFetch()`. A single shared axios/fetch follows the ACTIVE account automatically, with no re-attach on switch (headers are read fresh per request).
  - **Name accounts in the switcher.** `AccountSnapshot` gains `tenantName`; `addAccount(dto, { meta })` and `commitAccount(client, meta)` accept `AccountMeta` (`{ label?, tenantName? }`), and a new `setAccountMeta(accountId, meta)` stamps it after the app resolves the name — so a same-email owner's properties are distinguishable. A meta-less re-login no longer wipes a previously-set name; the React store re-renders on `tenantName` changes.
  - **Complete MFA when adding an account.** React `useAccountSwitcher()` gains `completeMfa(error, verifyDto, options?)` to finish an `addAccount` that threw `AccountMfaRequiredError` (verify2fa + commit); `commitAccount` is now on `IAccountSwitcher`, and cookie mode surfaces `AccountMfaRequiredError` too (mode parity).
  - **Add an account while authenticated.** `GuestGuard` gains `allowWhenAddingAccount`, and a new `<AddAccountGuard>` renders the login form for a Gmail-style "add another account" flow instead of redirecting the already-signed-in user away.

  All additions are backward-compatible (new optional params, new methods, new component, a widened `attachTo*` parameter type). Note: the exported `IAccountSwitcher` interface gained members — custom in-house implementers (not users of the shipped managers) must add them.

### Patch Changes

- @ackplus/nest-auth-contracts@2.6.0

## 2.5.2

### Patch Changes

- @ackplus/nest-auth-contracts@2.5.2
