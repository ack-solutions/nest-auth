# @ackplus/nest-auth-react

[![npm version](https://img.shields.io/npm/v/@ackplus/nest-auth-react.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-react)
[![npm downloads](https://img.shields.io/npm/dm/@ackplus/nest-auth-react.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-react)
[![license](https://img.shields.io/npm/l/@ackplus/nest-auth-react.svg)](https://www.npmjs.com/package/@ackplus/nest-auth-react)

React provider, hooks, guards, and first-class Next.js App Router helpers for [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth). Headless — bring your own UI.

> 📚 **Full documentation: [ack-solutions.github.io/nest-auth/docs/react](https://ack-solutions.github.io/nest-auth/docs/react/)**

---

## Why use it

A thin React layer on top of [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client) that gives you everything you'd build by hand: a context provider, narrow re-rendering hooks, guard components, route-level guards via Next.js Server Components, and cross-tab sync.

It's headless — no styled buttons, no opinionated forms — so it drops into any React 18 / 19 app or Next.js App Router project without fighting your design system.

## Install

```bash
pnpm add @ackplus/nest-auth-react @ackplus/nest-auth-client
```

| Peer | Versions |
| --- | --- |
| `react` | `^18.0.0 \|\| ^19.0.0` |

## What's included

| Surface | API |
| --- | --- |
| **Provider** | `<AuthProvider>` (client-rendered) · `<NextAuthProvider>` (with SSR initial-state hydration) |
| **Hooks** | `useNestAuth` · `useUser` · `useSession` · `useAccessToken` · `useAuthStatus` · `useHasRole` · `useHasPermission` |
| **Guard components** | `<AuthGuard>` · `<GuestGuard>` · `<RequireRole>` · `<RequirePermission>` |
| **HOCs** | `withRequireRole` · `withRequirePermission` (+ `createRequireRoleHOC` / `createRequirePermissionHOC` factories) |
| **Next.js helpers** | `createNextAuthHelpers` returning `{ getServerAuth, withAuth, createInitialState }` |
| **Cross-tab sync** | `CrossTabSync` / `createCrossTabSync()` — `BroadcastChannel` with `localStorage` fallback |

## Minimal example — SPA

```tsx
import { AuthClient } from '@ackplus/nest-auth-client';
import { AuthProvider, useNestAuth, AuthGuard, useUser } from '@ackplus/nest-auth-react';

const client = new AuthClient({ baseUrl: 'https://api.example.com' });

export default function App() {
  return (
    <AuthProvider client={client}>
      <Routes />
    </AuthProvider>
  );
}

function Dashboard() {
  return (
    <AuthGuard fallback={<a href="/login">Sign in</a>}>
      <DashboardInner />
    </AuthGuard>
  );
}

function DashboardInner() {
  const user = useUser();
  return <h1>Hello {user?.email}</h1>;
}

function LoginForm() {
  const { login, error, isLoading } = useNestAuth();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await login({ credentials: { email, password } });
    }}>
      {/* … */}
      <button disabled={isLoading}>Sign in</button>
      {error && <p>{error.message}</p>}
    </form>
  );
}
```

## Minimal example — Next.js App Router

```tsx
// app/layout.tsx (Server Component)
import { cookies } from 'next/headers';
import { NextAuthProvider } from '@ackplus/nest-auth-react';
import { client, authHelpers } from '@/lib/auth';

export default async function RootLayout({ children }) {
  const initialState = await authHelpers.getServerAuth(await cookies());

  return (
    <html lang="en">
      <body>
        <NextAuthProvider client={client} initialState={initialState}>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
```

```ts
// app/api/private/route.ts
import { authHelpers } from '@/lib/auth';

export const GET = authHelpers.withAuth(async (req) => {
  return Response.json({ user: req.auth.user });
});
```

[Full Next.js guide →](https://ack-solutions.github.io/nest-auth/docs/react/nextjs/)

## Role & permission gating

```tsx
import { RequireRole, RequirePermission, useHasRole } from '@ackplus/nest-auth-react';

<RequireRole role="admin" fallback={<NotAuthorized />}>
  <AdminPanel />
</RequireRole>

<RequirePermission permission={['orders.read', 'orders.write']} matchAll>
  <OrderEditor />
</RequirePermission>

// Or via hook
const isAdmin = useHasRole('admin');
```

## Documentation

| Section | What's there |
| --- | --- |
| [Provider](https://ack-solutions.github.io/nest-auth/docs/react/provider/) | `<AuthProvider>`, `<NextAuthProvider>`, all props |
| [Hooks](https://ack-solutions.github.io/nest-auth/docs/react/hooks/) | Every hook with return shape and re-render notes |
| [Guards](https://ack-solutions.github.io/nest-auth/docs/react/guards/) | Components + HOCs + factories |
| [Next.js](https://ack-solutions.github.io/nest-auth/docs/react/nextjs/) | App Router SSR pattern, `withAuth`, middleware redirect |
| [Cross-Tab Sync](https://ack-solutions.github.io/nest-auth/docs/react/cross-tab-sync/) | Multi-tab logout/login propagation |
| [Quickstart — React](https://ack-solutions.github.io/nest-auth/docs/getting-started/quickstart-react/) | SPA setup end to end |
| [Quickstart — Next.js](https://ack-solutions.github.io/nest-auth/docs/getting-started/quickstart-nextjs/) | App Router setup end to end |

## Companion packages

| Package | Use when |
| --- | --- |
| [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth) | The NestJS backend module this client talks to |
| [`@ackplus/nest-auth-client`](https://www.npmjs.com/package/@ackplus/nest-auth-client) | The vanilla JS client this package wraps |
| [`@ackplus/nest-auth-contracts`](https://www.npmjs.com/package/@ackplus/nest-auth-contracts) | Shared TS types (already a transitive dep) |

All four packages release together with the same version number. Pin them all to the same version.

## Links

- 📚 [Documentation](https://ack-solutions.github.io/nest-auth/)
- 💬 [Issue Tracker](https://github.com/ack-solutions/nest-auth/issues)
- 📦 [GitHub Repository](https://github.com/ack-solutions/nest-auth)

## License

[MIT](https://github.com/ack-solutions/nest-auth/blob/main/LICENSE)
