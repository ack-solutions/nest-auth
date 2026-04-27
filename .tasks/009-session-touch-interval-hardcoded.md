---
id: 009
priority: P2
area: backend
status: open
package: '@ackplus/nest-auth'
title: Session "touch" interval is hardcoded to 5 minutes
---

## Summary

`SessionManagerService` decides whether to touch a session row (update `lastActive`) based on a hardcoded `5 * 60 * 1000` ms threshold. Apps with finer-grained activity tracking — or apps trying to reduce DB writes — have no way to tune this.

## Where

`packages/nest-auth/src/lib/session/services/session-manager.service.ts:90` (approximately)

```ts
if (Date.now() - session.lastActive.getTime() > 5 * 60 * 1000) { … }
```

## Fix

Add `session.touchInterval?: number | string` to `IAuthModuleOptions`, default `'5m'`. Parse via the same `ms`-aware helper used elsewhere.

```ts
session?: {
  // …
  touchInterval?: number | string;     // default: '5m'
};
```

## Verification

- Set `touchInterval: '1m'` in `apps/example-nest`, hit `/auth/me` twice 90s apart, confirm `lastActive` updated.
- Set `touchInterval: '30m'`, repeat, confirm `lastActive` did **not** update.
- Document on the [Sessions & Tokens](apps/docs/content/docs/concepts/sessions-and-tokens.mdx) page.
