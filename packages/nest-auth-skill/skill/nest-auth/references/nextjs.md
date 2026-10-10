# Next.js (App Router)

Uses `@ackplus/nest-auth-react` (read `react.md` first). Use **cookie mode**: server components and middleware can then see the session.

The NestJS API and the Next app must share a site for cookies to flow (same domain, or proxy the API through a Next `rewrites` rule such as `/api/:path*` → the API). Prefer the rewrite in development.

## Client provider

```tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import { AuthClient } from '@ackplus/nest-auth-client';
import { NextAuthProvider } from '@ackplus/nest-auth-react';
import type { NextAuthProviderProps } from '@ackplus/nest-auth-react';

export function AuthProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: NextAuthProviderProps['initialState'];
}) {
  const client = useMemo(
    () => new AuthClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL as string, accessTokenType: 'cookie' }),
    [],
  );
  return (
    <NextAuthProvider client={client} initialState={initialState}>
      {children}
    </NextAuthProvider>
  );
}
```

## Server helpers

```ts
import { createNextAuthHelpers } from '@ackplus/nest-auth-react';

export const { getServerAuth, withAuth, createInitialState } = createNextAuthHelpers({
  baseUrl: process.env.NEXT_PUBLIC_API_URL as string,
  accessTokenType: 'cookie',
});
```

Root layout: read the session on the server and hand it to the provider so the first render is already signed in.

```tsx nocheck
// app/layout.tsx
import { cookies } from 'next/headers';
import { getServerAuth, createInitialState } from '@/lib/auth';
import { AuthProvider } from '@/providers/auth-provider';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const serverAuth = await getServerAuth({ cookies: await cookies() });
  return (
    <html lang="en">
      <body>
        <AuthProvider initialState={createInitialState(serverAuth)}>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

`getServerAuth` returns `{ user, session, indeterminate? }`. `user: null` with `indeterminate: true` means the API could not be reached; do not treat it as signed out (no redirect to login).

Protect a server page:

```tsx nocheck
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerAuth } from '@/lib/auth';

export default async function DashboardPage() {
  const { user, indeterminate } = await getServerAuth({ cookies: await cookies() });
  if (!user && !indeterminate) redirect('/login');
  return <h1>Hello {user?.email}</h1>;
}
```

## Middleware (optional, fast redirect)

```ts nocheck
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('accessToken');
  if (!hasSession && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
```

The cookie check is only a routing hint. The API verifies every request; never authorize from the cookie's presence.

## Notes

- Client components use the hooks and guards from `react.md` unchanged.
- Mark any file that uses hooks or `AuthClient` with `'use client'`.
- Pages Router: use `AuthProvider` in `_app.tsx` and call `getServerAuth(req)` from `getServerSideProps`.
