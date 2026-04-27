---
id: 008
priority: P2
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: SessionManagerService passes hardcoded "admin" reason to onRevoked hook
---

> **Fixed.** `SessionManagerService.revokeSession(sessionId, reason?)` now accepts a typed `reason` parameter (`'logout' | 'expired' | 'admin' | 'security' | 'password_change'`, default `'admin'` for back-compat). Updated callers to pass the real cause:
> - `AuthService` refresh-time validation failures (user-not-found, account-suspended, tenant-access, platform-access) → `'security'`
> - `AuthService.logout` → `'logout'`
> - `AdminUsersController.revokeSession` → `'admin'` (explicit, no longer relying on default)
>
> `rotateSession` already passed `'security'` correctly — left as-is. `revokeAllUserSessions` does not currently fire the hook (separate concern, not part of this task). Build verified clean.

## Summary

`SessionManagerService` calls the `session.onRevoked(session, reason)` hook with a hardcoded `'admin'` string regardless of the actual revocation reason. The downstream consumer (audit log, analytics) can't distinguish between a user-initiated logout, an admin force-revoke, a refresh-token expiry, or a password-change cascade.

## Where

`packages/nest-auth/src/lib/session/services/session-manager.service.ts:154` (approximately)

Current:
```ts
await this.options.session.onRevoked(session, 'admin');
```

## Impact

- Audit logs show every session revocation as `reason: 'admin'`.
- Consumers using `onRevoked` for telemetry can't aggregate by cause.
- Password-change-cascade revocations and explicit logouts look identical.

## Fix

Thread the actual reason through. The internal callers (`logout`, `logoutAll`, `passwordChanged`, `revokeExpired`) already know why they're revoking — pass it down:

```ts
async revoke(sessionId: string, reason: SessionRevocationReason = 'unknown') {
  // …
  await this.options.session.onRevoked?.(session, reason);
}
```

Where `SessionRevocationReason = 'logout' | 'logout_all' | 'password_change' | 'admin' | 'expired' | 'max_sessions_evicted' | 'unknown'`.

## Verification

- Update `apps/docs/content/docs/concepts/sessions-and-tokens.mdx` to document the reason values.
- Add a test that triggers each revocation path and asserts the right reason reaches the hook.
