# Route guards and role-based UI (React)

These control what the UI shows. The backend enforces access on every request, so treat them as navigation and display helpers.

## Signed-in and guest-only areas

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

Wire `toLogin` / `toHome` to the project's router (`useNavigate`, `router.push`, …). Both guards also take `fallback` (what to render instead). Pass `loadingFallback` so something shows while the session loads.

## Roles and permissions

```tsx
import { RequirePermission, RequireRole, useHasPermission, useHasRole } from '@ackplus/nest-auth-react';

export function OrdersToolbar() {
  const canDelete = useHasPermission('orders.delete');
  const isStaff = useHasRole(['admin', 'manager']);          // any of these; pass `true` as 2nd arg for all
  return (
    <div>
      <RequireRole role={['admin', 'manager']} fallback={null}>
        <a href="/orders/report">Report</a>
      </RequireRole>
      <RequirePermission permission="orders.read" fallback={<p>No access</p>}>
        <button disabled={!canDelete}>Delete all</button>
      </RequirePermission>
      {isStaff && <span>Staff</span>}
    </div>
  );
}
```

`RequireRole` / `RequirePermission` accept one name or a list, `matchAll`, `fallback`, `loadingFallback` and `onAccessDenied`. Role and permission changes made on the server reach the session user within about 30 seconds.

## Other ways

Use whichever fits the project's routing.

```tsx
import type { ComponentType } from 'react';
import { useAuthStatus, withRequireRole } from '@ackplus/nest-auth-react';

// HOC form
export function adminOnly<P extends object>(Page: ComponentType<P>) {
  return withRequireRole(Page, { role: 'admin' });
}

// The project's own wrapper
export function useGate() {
  const { isLoading, isAuthenticated } = useAuthStatus();
  return { isLoading, isAuthenticated };
}
```

- `withRequirePermission(Page, { permission })` is the permission HOC.
- Router-level checks (React Router loaders, TanStack Router `beforeLoad`) can use the shared client: `await authClient.ready(); authClient.getIsAuthenticated()`.
- Plain helpers: `hasRole(user, 'admin')`, `hasPermission(user, 'orders.read')` from `@ackplus/nest-auth-client`, with `user` from `useUser()`.
- "Add another account" pages while signed in: `AddAccountGuard`.
