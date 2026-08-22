# @ackplus/nest-auth-react

## 2.11.0

### Patch Changes

- @ackplus/nest-auth-client@2.11.0

## 2.10.4

### Patch Changes

- @ackplus/nest-auth-client@2.10.4

## 2.10.3

### Patch Changes

- @ackplus/nest-auth-client@2.10.3

## 2.10.2

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.10.2

## 2.10.1

### Patch Changes

- No SDK changes — lockstep bump for the refresh-token-401 fix (see `@ackplus/nest-auth@2.10.1`).
  - @ackplus/nest-auth-client@2.10.1
  - @ackplus/nest-auth-contracts@2.10.1

## 2.10.0

### Minor Changes

- **Added `verifyRecoveryCode(dto)`** to the provider / `useNestAuth()` — redeem an
  MFA recovery (backup) code to complete a sign-in (MFA stays enabled). Wraps the
  new client method; loads session data on success.
  - @ackplus/nest-auth-client@2.10.0
  - @ackplus/nest-auth-contracts@2.10.0

## 2.9.2

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA config fix (see `@ackplus/nest-auth@2.9.2`).
  - @ackplus/nest-auth-client@2.9.2
  - @ackplus/nest-auth-contracts@2.9.2

## 2.9.1

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA hardening patch (see `@ackplus/nest-auth@2.9.1`).
  - @ackplus/nest-auth-client@2.9.1
  - @ackplus/nest-auth-contracts@2.9.1

## 2.9.0

### Minor Changes

- **Fixed — `AuthProvider` no longer redirects to login during a server outage.**
  The mount-time session check called `onUnauthenticated()` (the callback apps
  use to redirect to login) whenever `verifySession()` failed — including on a
  network failure or a `5xx`. Now `onUnauthenticated()` fires **only on a
  definitive rejection** (the server answered 401/403). On an indeterminate
  failure the provider keeps the user where they are, surfaces the error via its
  `error` state, and never redirects.
- **Added** `AuthStatus` value **`'unknown'`** — a session check that couldn't be
  completed (server unreachable) resolves the initial `'loading'` to `'unknown'`
  rather than `'unauthenticated'`. Treat `'unknown'` as "we don't know yet", not
  as logged-out. (Requires `@ackplus/nest-auth-client@2.9.0`; `verifySession()`
  now throws on indeterminate failures.)
- **Fixed — the guards now honour `'unknown'`.** `AuthGuard`, `GuestGuard`,
  `RequireRole`, and `RequirePermission` fire their `onUnauthenticated` /
  `onAuthenticated` / `onAccessDenied` callbacks **only on a definitive state**.
  During a server outage (`'unknown'`) they render the loading fallback and never
  redirect, flash the login page, or deny access. `useAuthStatus()` gains
  `isUnknown`.
- **Fixed — Next.js SSR (helpers + hydration) no longer treats a backend outage as
  logged-out.** `getServerAuth` distinguishes an indeterminate verify failure (5xx /
  timeout / network) from a definitive 401/403, exposing `indeterminate` / `statusCode`
  on `ServerAuthState`. `withAuth` returns a retryable **503** (with `Retry-After`)
  instead of `401` when the check couldn't be completed. `createInitialState` carries
  the `indeterminate` flag through, and **`NextAuthProvider` hydrates an outage as
  `'unknown'` (not `'unauthenticated'`)** — so a page rendered during a backend blip no
  longer hydrates a valid session into a login redirect. Exported `resolveInitialStatus`
  is the pure status mapping. A genuine 401/403 still hydrates as `'unauthenticated'`.
  - @ackplus/nest-auth-client@2.9.0
  - @ackplus/nest-auth-contracts@2.9.0

## 2.8.0

### Patch Changes

- 2.8.0 security-hardening release (see `@ackplus/nest-auth`).
- Updated dependencies
  - @ackplus/nest-auth-client@2.8.0

## 2.7.6

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.6

## 2.7.5

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.5

## 2.7.4

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.4

## 2.7.3

### Patch Changes

- fix(react): make AuthContext & AccountSwitcherContext duplication-safe singletons

  When `@ackplus/nest-auth-react` ends up installed twice — common in pnpm / monorepos when a peer-React version split double-installs it — each copy called `createContext()` and got its OWN context object. `<AuthProvider>` from one copy populated one context while hooks imported from the other copy read a different, still-default context: `isLoading` stayed `true` forever, so `AuthGuard`, `RequirePermission` / `RequireRole`, and the `withRequirePermission` / `withRequireRole` HOCs silently rendered a blank page for authenticated users, with no error.
  - `AuthContext` and `AccountSwitcherContext` are now cross-realm singletons pinned on `globalThis` via `Symbol.for(...)`, so every duplicate copy of the package shares ONE context object. (Safe because React itself is a single instance via `peerDependency`; only the context _identity_ broke under duplication.)
  - Guards no longer fail completely silently while "loading": when a guard renders nothing purely because auth is still loading and no loading UI was supplied, a one-time dev-only `console.warn` now points at a duplicate install as the likely cause. Production builds stay silent.
  - Added a regression test asserting the contexts stay referentially identical (`===`) across a duplicate module resolution.

  No API changes — a drop-in fix. The real remedy for a duplicate install is still to dedupe `@ackplus/nest-auth-react` to a single copy; this makes the app work even when you can't.

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.3

## 2.7.2

### Patch Changes

- fix(client/react): reap orphaned per-account token namespaces + add reset() / discardPendingClient()

  `AccountManager` (header mode) could strand per-account token namespaces in storage (`<prefix>a_<uuid>_access_token` / `_refresh_token` / `_session`) forever: `removeAccount` can only target namespaces still in the index, so any namespace written but not (or no longer) indexed — an interrupted add-account, an abandoned MFA/OTP pending client, or an index/storage desync — leaked. Now:
  - **Automatic orphan GC** on `ready()` drops any `<prefix>a_<uuid>_*` namespace the account index no longer references, so the leak self-heals on the next boot. Needs a persistent storage adapter that exposes the new optional `StorageAdapter.keys()` (the built-in local/session/memory adapters implement it). Opt out with `reapOrphanStorageOnReady: false`. A corrupt/unparseable index never triggers destructive reaping.
  - **`reset()`** — remove every account, revoke each session server-side (best-effort), and wipe all per-account storage (added to `AccountManager`, `CookieAccountManager`, the `IAccountSwitcher` interface, and the React `useAccountSwitcher()`). Lets an app implement "a plain sign-in starts a fresh single-account session" without reverse-engineering storage keys.
  - **`discardPendingClient(client)`** — clear an abandoned `createPendingClient()` / `AccountMfaRequiredError` pending client so its tokens don't linger.

  Note: the exported `IAccountSwitcher` interface gained `reset()` — custom in-house implementers (not users of the shipped managers) must add it.

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.2

## 2.7.1

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.1

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

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.0

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

- Updated dependencies
  - @ackplus/nest-auth-client@2.6.0

## 2.5.2

### Patch Changes

- @ackplus/nest-auth-client@2.5.2
