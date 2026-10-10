# Multi-tenancy (React)

Only relevant when the backend has `tenant.enabled`. Check `useClientConfig()` (or ask) for the mode; the two modes need different screens.

| Backend mode | Login | Switching |
|---|---|---|
| `shared` | normal login; one account can belong to many tenants | `switchTenant` without signing in again |
| `isolated` | the tenant is chosen **before** login and sent as `tenantId` | sign in again under the other tenant |

## SHARED: tenant switcher

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useTenantSwitch() {
  const { switchTenant, session, getSessionData } = useNestAuth();
  return {
    activeTenantId: session?.tenantId ?? null,
    switchTo: async (tenantId: string) => {
      await switchTenant({ tenantId });   // new tokens scoped to that tenant
      await getSessionData();             // roles/permissions for the new tenant
      // then refetch tenant-scoped data (invalidate the query cache, etc.)
    },
  };
}
```

The list of tenants a user belongs to comes from the app's own API (the backend can build it with `UserService.getUserTenants`), or from extra fields the backend adds to the session user.

## ISOLATED: tenant first, then login

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useTenantLogin(baseUrl: string) {
  const { login, signup } = useNestAuth();

  async function findTenant(slug: string): Promise<{ id: string; name: string } | null> {
    const res = await fetch(`${baseUrl}/auth/tenants/lookup?slug=${encodeURIComponent(slug)}`);
    return res.ok ? res.json() : null;
  }

  return {
    findTenant,
    login: (tenantId: string, email: string, password: string) =>
      login({ providerName: 'email', credentials: { email, password }, tenantId }),
    signup: (tenantId: string, email: string, password: string) => signup({ email, password, tenantId }),
  };
}
```

Also pass `tenantId` to `passwordlessSend`, `passwordlessLogin` and `verifyForgotPasswordOtp`.

Ways to know the tenant before login — pick what suits the product: a subdomain per tenant (read the slug from `window.location.hostname`), a "workspace" field on the login form, a path segment, or an email-first step backed by the app's own endpoint.

## Notes

- After a tenant change, role and permission hooks reflect the new tenant; refetch tenant-scoped data.
- For a Gmail-style switcher between separate accounts (rather than tenants of one account), see the account switcher in `setup.md`.
