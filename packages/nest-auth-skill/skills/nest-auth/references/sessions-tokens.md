# Sessions and tokens

Every login creates a server-side session plus a short-lived access token and a rotating refresh token. The SDKs refresh automatically.

## Cookie or header

| Mode | Use for | How tokens travel |
|---|---|---|
| `cookie` | browser apps (recommended) | http-only cookies; JavaScript never sees the tokens |
| `header` | mobile, server-to-server, cross-site APIs, or a browser app that prefers it | `Authorization: Bearer`; the client stores the tokens |

Both work in every client. Cookie mode protects tokens from XSS but needs same-site (or correctly configured cross-site) cookies. Header mode is simpler across domains but the tokens live in JavaScript-readable storage. Use what the user asks for.

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

Set only the keys that differ from the defaults.

### Session store

- `SessionStorageType.DATABASE` (default): no extra infrastructure.
- `SessionStorageType.REDIS`: add `redisUrl` (or `redis: { host, port, ... }`) and install `ioredis`.
- `SessionStorageType.MEMORY`: tests and single-process development only.
- `SessionStorageType.CUSTOM` with `store`: your own `SessionStore` implementation.

Other session options: `slidingExpiration` (extend on activity), `touchInterval`, `refreshTokenReuse`, and the hooks `customizeSessionData`, `customizeTokenPayload`, `validateToken`, `onCreated`, `onRefreshed`, `onRevoked` (see `advanced.md`).

### User-state cache (`userStateCache`)

The guard needs three user fields on every request (`isActive`, `mustChangePassword`, `emailVerifiedAt`). Caching them is what makes a warm authenticated request cost **zero database queries**.

```ts
session: {
  storageType: SessionStorageType.REDIS,
  redis: { url: process.env.REDIS_URL },
  userStateCache: {
    enabled: true,      // default: true on Redis, false on database/memory
    ttlSeconds: 300,    // default: 300 shared, 5 per-process
  },
}
```

Defaults are chosen for safety, not speed:

- **Redis store → ON.** The cache is shared, so an invalidation on one instance is seen by all of them.
- **Database / memory store → OFF.** The cache would be per process; deactivating an account on instance A would not reach instance B until the TTL expired. Opt in only if you accept that window.

Invalidation is automatic for **writes through TypeORM** — a `NestAuthUser` entity subscriber drops the entry, so `UserService` calls and a bare `user.save()` are both covered.

It is **not** automatic for writes TypeORM cannot see: `repository.update()` and other bulk `UPDATE`s, raw SQL, migrations, or another app writing the same database. Those must invalidate explicitly, or the account stays stale until `ttlSeconds`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NestAuthCacheService } from '@ackplus/nest-auth';

@Injectable()
export class BulkDeactivateService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly nestAuthCache: NestAuthCacheService,
  ) {}

  async deactivate(userId: string): Promise<void> {
    await this.dataSource.query(
      'UPDATE nest_auth_users SET "isActive" = false WHERE id = $1',
      [userId],
    );
    // Required: subscribers do not fire for raw SQL, so without this the
    // account keeps working until the cached entry expires.
    await this.nestAuthCache.invalidateUser(userId);
  }
}
```

Every invalidation emits `NestAuthEvents.USER_STATE_INVALIDATED` with `{ userId }`. Set `enabled: false` to restore the pre-2.17.0 behaviour of reading the user row on every request.

### Cookie mode checklist

- `app.use(cookieParser())` in `main.ts`.
- CORS: `credentials: true`, explicit `origin` list.
- Frontend and API on different sites (not just different ports or subdomains): either set `sameSite: 'none'` with `secure: true`, or serve the API from the same site through a proxy/rewrite, or use header mode.
- CSRF: `security: { csrf: { enabled: true, allowedOrigins: [...] } }` adds double-submit protection for cookie-authenticated writes.

## Client behaviour

- `autoRefresh` is on: the client refreshes shortly before expiry and retries once on a 401.
- Only a 401/403 from refresh/verify ends the session. Network errors and 5xx keep the tokens and throw an error with `error.kind === 'indeterminate'`; treat that as "retry", not "logged out".
- Header mode storage: `LocalStorageAdapter` (default), `SessionStorageAdapter`, `CookieStorageAdapter`, `MemoryStorage`, or your own `StorageAdapter`.
- `autoRefresh: false` if the app wants to drive refresh itself with `auth.refresh()`.

## Session management

`auth.logout()` ends this session. `auth.logoutAll()` ends every session of the user. `auth.verifySession()` checks it. `GET /auth/me` (`getSessionData()` in React) returns the user with roles and permissions.

A "your devices" screen: there is no built-in endpoint for listing sessions. Add a small controller in the app that uses `SessionManagerService` (`getUserSessions(userId)`, `revokeSession(id)`, `revokeOtherSessions(userId, currentSessionId)`).

Deactivating a user revokes their sessions. Role and permission changes reach signed-in users within 30 seconds (`authorization.liveSessionRoles`).

## Multiple accounts on one device

For a Gmail-style account switcher: `session.allowMultipleAccounts: true` plus `AccountManager` (header) / `CookieAccountManager` on the client, and `AccountSwitcherProvider` / `useAccountSwitcher` in React. Docs: https://ack-solutions.github.io/nest-auth/docs/recipes/multi-account-switching
