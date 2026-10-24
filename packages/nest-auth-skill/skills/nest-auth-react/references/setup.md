# Setup (React)

Next.js: read `nextjs.md` as well. React Native: `react-native.md`.

## Install

Use the project's package manager.

```bash
npm i @ackplus/nest-auth-react @ackplus/nest-auth-client
```

## Client and provider

Create one client and wrap the app once, above the router.

```tsx
import type { ReactNode } from 'react';
import { AuthClient } from '@ackplus/nest-auth-client';
import { AuthProvider } from '@ackplus/nest-auth-react';

export const authClient = new AuthClient({
  baseUrl: 'https://api.example.com', // from the project's env, e.g. import.meta.env.VITE_API_URL
  accessTokenType: 'cookie',          // or 'header'
});

export function AppAuthProvider({ children }: { children: ReactNode }) {
  return <AuthProvider client={authClient}>{children}</AuthProvider>;
}
```

- `baseUrl` is the API origin plus any global prefix; the client appends `/auth/...`.
- `accessTokenType`: `'cookie'` keeps tokens in http-only cookies (recommended for browsers); `'header'` stores them in the browser and sends `Authorization`. Match what the backend allows. Both are fully supported.
- Other client options: `storage`, `httpAdapter`, `endpoints`, `autoRefresh`, callbacks. See `client-js.md`.
- `AuthProvider` also accepts `onUnauthenticated`, `onTokensSet`, `onTokensRemoved` and `initialState`.

## Send auth on the app's own API calls

```ts
import type { AuthClient, AxiosLikeInstance } from '@ackplus/nest-auth-client';

export function wireApi(auth: AuthClient, api: AxiosLikeInstance) {
  // adds the token (or credentials in cookie mode), refreshes and retries once on a 401
  return auth.attachToAxios(api, { onRefreshFailed: () => { /* go to login */ } });
}
```

Other ways: `auth.attachToFetch()` for fetch; `useAuthHeaderFn()` or `auth.getAuthHeaders()` for GraphQL, tRPC, WebSocket or a generated API client; nothing extra in cookie mode beyond sending credentials. Details in `client-js.md`.

## Hooks

```tsx
import { useNestAuth, useUser } from '@ackplus/nest-auth-react';

export function AccountMenu() {
  const { isAuthenticated, isLoading, logout } = useNestAuth();
  const user = useUser(); // session user with roles/permissions, or null

  if (isLoading) return <span>…</span>;
  if (!isAuthenticated) return <a href="/login">Sign in</a>;
  return <button onClick={() => logout()}>Sign out {user?.email}</button>;
}
```

- `useNestAuth()` — state (`status`, `isAuthenticated`, `isLoading`, `sessionData`, `error`, `client`) and every action (`login`, `signup`, `logout`, `passwordlessSend`, `verify2fa`, `forgotPassword`, `switchTenant`, …).
- `useUser()`, `useSession()`, `useAuthStatus()`, `useAccessToken()`, `useHasRole(role)`, `useHasPermission(permission)`, `useAuthHeaderFn()`.
- `useClientConfig()` — what the backend has enabled (login methods, social providers and their public IDs, MFA, tenancy, registration). Use it to render only the options that exist.

## What the backend must provide

Tell the user if any of these is missing; they are server settings, not frontend code.

- CORS allowing the app's origin, the `x-access-token-type` header, and `credentials: true` for cookie mode.
- The login methods the UI offers, enabled in the backend options.
- For cookie mode across different sites: `sameSite: 'none'` + `secure`, or a same-site proxy. Otherwise use header mode.

## Other ways to set this up

- **No provider:** use `authClient` directly and keep auth state in the project's store (Redux, Zustand, signals). Subscribe with `authClient.onLogout`, `onTokensSet`, `subscribeTokenState`.
- **Several accounts at once:** `AccountSwitcherProvider`, `useAccountSwitcher`, `AddAccountGuard` (needs `session.allowMultipleAccounts` on the backend). Feed `AuthProvider` the active account's client; on a switch it drops the previous account's `sessionData` and goes back to `'loading'`, so permissions always follow the active account. For a custom add-account sign-in, `manager.createPendingClient?.()`, then `commitAccount(client)` on success or `manager.discardPendingClient?.(client)` if the user abandons an OTP/MFA step (header mode only; both are `undefined` on `CookieAccountManager`).
- **Cross-tab sync** (logout in one tab signs out the others): `createCrossTabSync`.

## Pitfalls

- Use one `AuthClient` per app. If it is created inside a component, wrap it in `useMemo`, or the session resets on every render.
- `sessionData` is `null` until the session loads; gate on `isLoading`.
- Two installed copies of `@ackplus/nest-auth-react` (version mismatch in a monorepo) cause endless loading. Deduplicate.
