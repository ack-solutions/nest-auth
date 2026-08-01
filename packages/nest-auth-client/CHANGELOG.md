# @ackplus/nest-auth-client
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
