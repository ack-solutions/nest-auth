# React (`@ackplus/nest-auth-react`)

```bash
npm i @ackplus/nest-auth-react @ackplus/nest-auth-client
```

Next.js: read `nextjs.md` as well. React Native: `mobile.md`.

## Provider

Create one client and wrap the app once, above the router.

```tsx
import type { ReactNode } from 'react';
import { AuthClient } from '@ackplus/nest-auth-client';
import { AuthProvider } from '@ackplus/nest-auth-react';

const client = new AuthClient({
  baseUrl: 'https://api.example.com', // from the project's env, e.g. import.meta.env.VITE_API_URL
  accessTokenType: 'cookie',
});

export function AppAuthProvider({ children }: { children: ReactNode }) {
  return <AuthProvider client={client}>{children}</AuthProvider>;
}
```

Export `client` and attach it to the project's axios/fetch layer (see `client-js.md`) so API calls carry the session. `AuthProvider` also accepts `onUnauthenticated`, `onTokensSet`, `onTokensRemoved` and `initialState`.

## Hooks

```tsx
import { useState } from 'react';
import { useNestAuth, useUser } from '@ackplus/nest-auth-react';

export function LoginForm({ onDone }: { onDone: () => void }) {
  const { login, isLoading } = useNestAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await login({ providerName: 'email', credentials: { email, password } });
      if (res.isRequiresMfa) return; // show the MFA step, see mfa.md
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button disabled={isLoading}>Sign in</button>
    </form>
  );
}

export function Greeting() {
  const user = useUser(); // session user with roles/permissions, or null
  return <span>{user?.email}</span>;
}
```

The snippet only shows the calls. Build the real form with whatever the project uses (react-hook-form, Formik, MUI, shadcn, plain inputs).

- `useNestAuth()` — state (`status`, `isAuthenticated`, `isLoading`, `sessionData`, `error`) and every action (`login`, `signup`, `logout`, `passwordlessSend`, `verify2fa`, `forgotPassword`, `switchTenant`, …).
- `useUser()`, `useSession()`, `useAuthStatus()`, `useAccessToken()`, `useHasRole(role)`, `useHasPermission(permission)`, `useClientConfig()`, `useAuthHeaderFn()`.

## Route guards

```tsx
import type { ReactNode } from 'react';
import { AuthGuard, GuestGuard } from '@ackplus/nest-auth-react';

// Private area: render children only when signed in.
export function Private({ children, toLogin }: { children: ReactNode; toLogin: () => void }) {
  return (
    <AuthGuard loadingFallback={<p>Loading…</p>} onUnauthenticated={toLogin}>
      {children}
    </AuthGuard>
  );
}

// Login / signup pages: keep signed-in users out.
export function GuestOnly({ children, toHome }: { children: ReactNode; toHome: () => void }) {
  return <GuestGuard onAuthenticated={toHome}>{children}</GuestGuard>;
}
```

Wire `toLogin` / `toHome` to the project's router (`useNavigate`, `router.push`, …). Pass `loadingFallback` so something shows while the session loads. Role/permission guards (`RequireRole`, `RequirePermission`) are in `roles-permissions.md`.

Other ways to protect routes: the HOCs `withRequireRole` / `withRequirePermission`; a router-level check (React Router loader, TanStack Router `beforeLoad`) using the shared `client`; or the project's existing `ProtectedRoute` component reading `useAuthStatus()`.

## Also available

- Cross-tab sync (logout in one tab signs out the others): `createCrossTabSync`.
- Account switcher: `AccountSwitcherProvider`, `useAccountSwitcher`, `AddAccountGuard`.
- No provider at all: call the `AuthClient` directly and keep state in the project's own store (Redux, Zustand, signals).

## Pitfalls

- Use one `AuthClient` per app. If it is created inside a component, wrap it in `useMemo`, or the session resets on every render.
- `sessionData` is `null` until the session loads; gate on `isLoading`.
- Two installed copies of `@ackplus/nest-auth-react` (version mismatch in a monorepo) cause endless loading. Deduplicate.
