# Sessions and tokens

Every login creates a server-side session plus a short-lived access token and a rotating refresh token. The SDKs refresh automatically.

## Cookie or header

| Mode | Use for | How tokens travel |
|---|---|---|
| `cookie` | browser apps (default choice) | http-only cookies; JS never sees the tokens |
| `header` | mobile, server-to-server, cross-site APIs | `Authorization: Bearer`, stored by the client |

`session.accessTokenType` on the backend: leave it unset to let each client choose (the SDK sends its mode in `x-access-token-type`), or set `'cookie'` / `'header'` to force one. Set the same value in the client config.

```ts
import { SessionStorageType } from '@ackplus/nest-auth';
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const session: Partial<IAuthModuleOptions> = {
  session: {
    jwt: { secret: process.env.JWT_SECRET as string },
    accessTokenType: 'cookie',
    accessTokenValidity: '15m',          // default '1h'
    refreshTokenValidity: '30d',         // default '30d'
    maxSessionsPerUser: 10,              // default 10
    cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
    storageType: SessionStorageType.DATABASE, // default. REDIS needs `redisUrl` + ioredis
  },
};
```

Only set the keys that differ from the defaults.

### Cookie mode checklist

- `app.use(cookieParser())` in `main.ts`.
- CORS: `credentials: true`, explicit `origin` list.
- Frontend and API on different sites (not just different ports/subdomains): cookies need `sameSite: 'none'` + `secure: true`, or put the API behind the same site with a proxy/rewrite. Prefer the proxy.
- CSRF: `security: { csrf: { enabled: true, allowedOrigins: [...] } }` adds double-submit protection for cookie-authenticated writes.

## Client behaviour

- `autoRefresh` is on: the client refreshes shortly before expiry and retries once on a 401.
- Only a 401/403 from refresh/verify ends the session. Network errors and 5xx keep the tokens and throw an error with `error.kind === 'indeterminate'`; treat that as "retry", not "logged out".
- Header mode storage: `LocalStorageAdapter` (default in browsers), `SessionStorageAdapter`, `MemoryStorage`, or a custom `StorageAdapter`.

## Session management

`auth.logout()` ends this session. `auth.logoutAll()` ends every session of the user. `auth.verifySession()` checks it. `GET /auth/me` (`getSessionData()` in React) returns the user with roles and permissions.

Deactivating a user revokes their sessions. Role and permission changes reach signed-in users within 30 seconds (`authorization.liveSessionRoles`).

## Multiple accounts on one device

`session.allowMultipleAccounts: true` plus `AccountManager` (header) / `CookieAccountManager` on the client. Only add when a Gmail-style account switcher is requested. Docs: https://ack-solutions.github.io/nest-auth/docs/recipes/multi-account-switching
