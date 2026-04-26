# @ackplus/nest-auth-react

React provider, hooks, guards, and Next.js helpers for [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth).

## Documentation

**Full reference at [ack-solutions.github.io/nest-auth/docs/react](https://ack-solutions.github.io/nest-auth/docs/react).**

- [Provider](https://ack-solutions.github.io/nest-auth/docs/react/provider) — `<AuthProvider>` and `<NextAuthProvider>`
- [Hooks](https://ack-solutions.github.io/nest-auth/docs/react/hooks) — `useNestAuth`, `useUser`, `useSession`, `useAccessToken`, `useAuthStatus`, `useHasRole`, `useHasPermission`
- [Guards](https://ack-solutions.github.io/nest-auth/docs/react/guards) — `<AuthGuard>`, `<GuestGuard>`, `<RequireRole>`, `<RequirePermission>` + HOCs
- [Next.js](https://ack-solutions.github.io/nest-auth/docs/react/nextjs) — App Router SSR
- [Cross-Tab Sync](https://ack-solutions.github.io/nest-auth/docs/react/cross-tab-sync)

## Install

```bash
pnpm add @ackplus/nest-auth-react @ackplus/nest-auth-client
```

Peer: `react` (^18 or ^19).

## Minimal example

```tsx
import { AuthClient } from '@ackplus/nest-auth-client';
import { AuthProvider, useNestAuth } from '@ackplus/nest-auth-react';

const client = new AuthClient({ baseUrl: '/api' });

export default function App() {
  return (
    <AuthProvider client={client}>
      <Routes />
    </AuthProvider>
  );
}

function LoginButton() {
  const { login } = useNestAuth();
  return <button onClick={() => login({ credentials: { email, password } })}>Sign in</button>;
}
```

See the [React quickstart](https://ack-solutions.github.io/nest-auth/docs/getting-started/quickstart-react) and the [Next.js quickstart](https://ack-solutions.github.io/nest-auth/docs/getting-started/quickstart-nextjs).

## License

MIT
