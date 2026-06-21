# @ackplus/nest-auth-client

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
