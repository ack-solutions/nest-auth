# @ackplus/nest-auth-client

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
