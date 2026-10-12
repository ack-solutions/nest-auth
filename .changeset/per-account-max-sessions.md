---
'@ackplus/nest-auth': minor
---

`session.maxSessionsPerUser` can vary per account, and evictions now fire `onRevoked`.

**Per-account session cap**

`maxSessionsPerUser` accepted a single number applied to every account. It now also accepts a resolver, asked once per sign-in:

```ts
session: {
  maxSessionsPerUser: ({ userId, data }) =>
    data.roles?.some((r) => r.name === 'staff') ? 20 : 3,
},
```

The context carries the account id and the session data about to be stored — including that account's `roles` and `permissions` — so the cap can key off role, tenant or plan. The function may be async.

A plain number behaves exactly as before. The cap must be a positive whole number; unset, `0`, negative, fractional, `NaN` or a non-number result falls back to the default of `10`. `hasReachedMaxSessions(userId, data?)` takes the same optional context and resolves the cap the same way.

**Evictions are no longer silent**

Evicting a session to make room went through a raw store delete, so `session.onRevoked` never fired and apps could not observe it. Eviction now goes through the normal revoke path and fires `onRevoked(session, 'evicted')`. `'evicted'` is a new member of the reason union, exported as `SessionRevokeReason`.

If your `onRevoked` switches exhaustively on `reason`, add a case for `'evicted'` — it is a widened union, so a `switch` with no `default` will no longer be exhaustive at compile time.

**Apps can now delete**

- Any per-role or per-plan session-capping workaround that wrapped `createSession` or swept sessions after the fact.
- Any eviction bookkeeping that polled the session store because evictions were unobservable.

New exported types: `MaxSessionsContext`, `MaxSessionsResolver`, `SessionRevokeReason`.

Also corrects the docs, which claimed `maxSessionsPerUser: 0` disabled the cap. It never did — `0` fell through to the default of `10`, and still does.
