---
id: 003
priority: P1
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: EmailAuthProvider.validate() returns email in the userId field
---

> **Fixed.** One-line change in
> `email-auth.provider.ts`: `userId: identity.user?.email` →
> `userId: identity.user?.id`. Build verified clean.

## Summary

`EmailAuthProvider.validate()` returns an object whose `userId` field is set to the user's **email**, not their `id` (UUID). Downstream code that trusts `validate()`'s return shape will end up using an email where a UUID is expected.

## Where

`packages/nest-auth/src/lib/core/providers/email-auth.provider.ts:46-64`

```ts
async validate(credentials: EmailCredentialsDto, tenantId?: string) {
  // …
  return {
    userId: identity.user?.email,         // ← should be identity.user?.id
    email: identity.user?.email || '',
    metadata: identity.user,
  };
}
```

## Impact

Depending on how the caller uses `userId` — session creation, audit log, identity row insertion — this can result in either silent data corruption (UUID column populated with an email) or a runtime error. At minimum, audit/event payloads carry the wrong identifier.

The same bug exists in `PhoneAuthProvider` — see #004.

## Fix

```diff
- userId: identity.user?.email,
+ userId: identity.user?.id,
```

## Related

- See #004 for the phone-provider equivalent.
- Cross-check every provider's `validate()` return shape — Google/Facebook/Apple/GitHub already use `payload.sub`/`me.id` correctly, so the bug is contained to email/phone.

## Verification

- Walk a signup → login flow with email auth and assert that `request.user.id` is a UUID (not an email).
- Add an integration test that exercises the full email-login path end-to-end.
