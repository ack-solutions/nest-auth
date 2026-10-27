---
id: 025
priority: P1
area: backend / performance
status: in-progress
package: '@ackplus/nest-auth'
title: 'Redis-backed auth still costs a DB query per request, and authz state goes stale across instances (GitHub #13)'
---

> **Upstream:** [ack-solutions/nest-auth#13](https://github.com/ack-solutions/nest-auth/issues/13).
>
> Five separate problems were reported together. Fixed so far: **problem 4** (2.16.0) and **problem 1** (2.17.0). Problems **2, 3 and 5** are still open — see the table below. The file stays `in-progress` until all five are closed.

## Summary

The library advertises Redis session storage as the answer to horizontal scale, but with Redis configured an authenticated request was still doing per-request database work, and some authorization state was cached in a way that only one process could see.

| # | Problem | Status |
| --- | --- | --- |
| 1 | The guard read the user row (`isActive`, `mustChangePassword`, `emailVerifiedAt`) on **every** authenticated request — one `SELECT` per API call | **fixed in 2.17.0** |
| 2 | `sessionAuthzCache` is a per-process `Map`, so a role or permission change is picked up by whichever instance handled the write and ignored by the rest until its entry ages out | open |
| 3 | API-key auth makes three separate calls (`validateAccessKey`, `getAccessKey`, `updateAccessKeyLastUsed`) per request | open |
| 4 | A Redis outage was read as "no session", silently opening optional-auth routes; and the library could not reuse an app's existing ioredis connection | **fixed in 2.16.0** |
| 5 | No documented consistency table for what is live vs. snapshotted on an active session | open |

## Where

- `packages/nest-auth/src/lib/auth/guards/auth.guard.ts` — the guard. Problem 1's read was at the `NestAuthUser.findOne` call; problem 2's `sessionAuthzCache` `Map` is still there; problem 3's three API-key calls are in `handleApiKeyAuth`.
- `packages/nest-auth/src/lib/session/repositories/redis-session.repository.ts` — problem 4's typed `SessionStoreUnavailableError` and the connection lifecycle.

## Impact

Problem 1 meant the database pool still scaled with API traffic after a customer had paid for Redis — the exact cost Redis was supposed to remove. Problem 2 is the more serious of the remainder: a revoked role keeps working on every instance that did not serve the write.

## Fix

**Problem 1 (2.17.0) — cache the user state, and invalidate it everywhere.**

Caching `isActive` is only safe if every write drops the entry, otherwise a stale entry is an authentication bypass. So:

- `NestAuthCacheService` (`core/services/nest-auth-cache.service.ts`) holds the three fields behind an `AuthStateCache`. The Redis backend reuses the **session store's own connection** (`RedisSessionStore.getClient()`), so there is one pool; everything else gets an in-process cache.
- `NestAuthUserCacheSubscriber` (`user/subscribers/user-cache.subscriber.ts`) is a TypeORM entity subscriber on `NestAuthUser`. This is the chokepoint: it fires for `UserService` writes **and** for a bare `user.save()` such as the admin console's.
- `NestAuthCacheService.invalidateUser(userId)` is exported for the writes TypeORM cannot see — `repository.update()` and other bulk `UPDATE`s, raw SQL, migrations, another app on the same database.
- Defaults follow reachability, not speed: **on** for Redis (shared, so an invalidation reaches every instance), **off** for the database/memory stores (per-process, so instance B would serve a deactivated account until its TTL expired). `session.userStateCache.enabled` overrides either way.
- A missing account is never cached, so a deleted user is refused immediately.

Also fixed in passing: a Redis connection the library opened was never closed on shutdown, leaking a socket per app instance (`ECONNRESET` noise on teardown). `RedisSessionStore.onModuleDestroy` now closes a client it owns, and still leaves an app-supplied `session.redis.client` alone.

**Problems 2, 3, 5 — not started.** Problem 2 needs an authz version counter in the shared store, not a per-process `Map`; problem 3 needs one read plus a throttled write; problem 5 is a docs table.

## Verification

Real Postgres + real Redis via Testcontainers, two app instances sharing them, and a SQL counter. Suites **skip** (never silently pass) without Docker.

- `test/integration/redis-real-infra-baseline.test.ts` — asserts a warm authenticated request costs **0** database queries, and names the `nest_auth_users` read specifically so a regression says what broke. This file recorded the pre-fix baseline of 1 query.
- `test/integration/user-state-cache.test.ts` — 10 tests: an ORM write deactivating an account is refused on the next request; `mustChangePassword` and `emailVerifiedAt` propagate; a deleted account is refused; a deactivation on instance A is enforced by instance B; a bulk `UPDATE` is shown **not** to invalidate (the documented limitation, asserted rather than left as a footnote) and `invalidateUser()` shown to fix it; `enabled: false` restores the per-request read; the per-process default is proven OFF; and the library's own Redis client is closed on shutdown.
- `test/integration/redis-connection-and-failclosed.test.ts` — problem 4, including that an app-supplied client survives app shutdown.

Mutation-tested: removing the subscriber registration turns 6 tests red; defaulting the per-process cache to ON turns the default test red; removing the shutdown hook turns the leak test red; removing the ownership check turns the app-owned-client test red.

## Related

- Docs: [user-state cache](../apps/docs/content/docs/concepts/session-storage.mdx), [`NestAuthCacheService`](../apps/docs/content/docs/backend/services.mdx), [scaling](../apps/docs/content/docs/production/scaling.mdx), [production checklist](../apps/docs/content/docs/production/production-checklist.mdx).
- Skill: `packages/nest-auth-skill/skills/nest-auth/references/sessions-tokens.md`.
