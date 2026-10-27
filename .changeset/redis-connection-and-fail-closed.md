---
'@ackplus/nest-auth-contracts': minor
'@ackplus/nest-auth': minor
---

Share your own Redis connection, and fail closed when the session store is down. (Issue #13, problem 4, plus the proving ground for the rest.)

**Security fix: a Redis outage no longer opens optional-auth routes**

The guard treated *any* error during authentication as a failed sign-in. On a route with optional auth that meant a session-store outage was read as "no session": the request was reset to anonymous and served. A route carrying `@NestAuthRoles` or `@NestAuthPermissions` alongside optional auth was therefore open for the duration of a Redis outage.

Two independent `catch` blocks did this — one in `handleJwtAuth`, one in `canActivate` — so both are fixed. The Redis store now raises a typed `SessionStoreUnavailableError` instead of a plain `Error`, and the guard rethrows it before either optional-auth branch.

A store outage is now refused on every route:

| | Response |
| --- | --- |
| Required auth | `503` `SESSION_STORE_UNAVAILABLE` |
| Optional auth, token presented | `503` `SESSION_STORE_UNAVAILABLE` |
| Optional auth, no token | unchanged — normal anonymous response |

`503` rather than `401` is deliberate: a `401` makes clients sign the user out, so a brief Redis blip would log out every user. `503` means retry. The outage is logged once when it starts and once when it clears, not once per request.

**New option: `session.redis.client`**

```ts
const redis = new Redis(process.env.REDIS_URL);
NestAuthModule.forRoot({
  session: { storageType: 'redis', redis: { client: redis, keyPrefix: 'auth:' } },
});
```

Reuses your existing ioredis connection instead of opening a second one, so TLS, password, sentinel and cluster are configured once. Other connection fields are ignored when `client` is set; `keyPrefix` and `ttlSeconds` still apply. The library never calls `quit()` on a client it did not create.

**Bug fix: live objects survived config merging**

`NestAuthModule.getOptions` deep-merges caller options, which rebuilds a class instance as a plain object and strips its prototype. `session.store` and `customAuthProviders` were already protected; `session.redis.client` now is too. Without it an injected client arrived with every method gone (`this.redis.smembers is not a function`).

**New**

- `SessionStoreUnavailableError`, exported from the package root.
- `SESSION_STORE_UNAVAILABLE` error code, in both the server and `@ackplus/nest-auth-contracts`.

**Test infrastructure**

Issue #13's remaining problems cannot be proven on sqljs with an in-process store, so this adds the harness they need: real Postgres and real Redis via Testcontainers, two app instances sharing them, and a SQL counter for asserting how many database round trips a request costs. Suites skip (not silently pass) when Docker is unavailable.

It records a measured baseline for problem 1: with the Redis store, a warm authenticated request still costs **1 database query** — the guard's `nest_auth_users` read. That is the number the next phase has to drive to zero.

**Not included** — issue #13 problems 1, 2, 3 and 5 (user-state caching, cross-instance authz versioning, API-key caching, and the live-session consistency table) are unchanged and still to come.
