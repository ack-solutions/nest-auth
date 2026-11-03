---
"@ackplus/nest-auth": minor
---

Add `session.refreshTokenReuse.graceSeconds` so a lost refresh reply no longer signs the user out (#14).

With rotation, a refresh whose reply never reached the client (dropped mobile signal, a client timeout, a proxy cut, the server stopped mid-response) left the client holding the token the server had just replaced. Its retry looked like reuse, so the session was revoked and the user signed out.

```ts
session: {
  refreshTokenReuse: { graceSeconds: 30 }, // default 0 = unchanged
}
```

Within `graceSeconds` of a rotation, the token it replaced is accepted once: the server rotates again, answers with a fresh pair and emits the new `NestAuthEvents.REFRESH_TOKEN_GRACE_USED` (`{ sessionId, userId }`) instead of `REFRESH_TOKEN_REUSE_DETECTED`. After that retry, neither the retried token nor the pair whose reply was lost works. Outside the window, or for any other token, reuse handling is unchanged.

The previous hash is stored in the session's existing `refreshToken` column, so there is no migration and custom session stores need no change. The default of `0` keeps today's behaviour exactly. Downgrading below this version after sessions rotated with the grace on signs those sessions out once.
