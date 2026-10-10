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

Export `client` and attach it to the project's axios/fetch layer (see `client-js.md`) so API calls carry the session.

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

Build forms with the project's existing form and UI libraries; the snippet only shows the calls.

- `useNestAuth()` — state (`status`, `isAuthenticated`, `isLoading`, `sessionData`, `error`) and every action (`login`, `signup`, `logout`, `passwordlessSend`, `verify2fa`, `forgotPassword`, `switchTenant`, …).
- `useUser()`, `useSession()`, `useAuthStatus()`, `useHasRole(role)`, `useHasPermission(permission)`, `useClientConfig()`.

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

Wire `toLogin` / `toHome` to the project's router (`useNavigate`, `router.push`, …). Always pass `loadingFallback`: without it a guard renders nothing while the session loads. Role/permission guards (`RequireRole`, `RequirePermission`) are in `roles-permissions.md`.

## Pitfalls

- One `AuthProvider`, one `AuthClient`. Creating the client inside a component without `useMemo` resets the session on every render.
- `sessionData` is `null` until the session loads; gate on `isLoading`.
- Two installed copies of `@ackplus/nest-auth-react` (version mismatch in a monorepo) cause endless loading. Deduplicate.
