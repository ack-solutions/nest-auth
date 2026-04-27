---
id: 004
priority: P1
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: PhoneAuthProvider.validate() returns phone number in the userId field
---

> **Fixed.** One-line change in
> `phone-auth.provider.ts`: `userId: identity.user?.phone` →
> `userId: identity.user?.id`. Build verified clean.

## Summary

Same shape bug as #003 but in the phone provider — `validate()` returns the phone number where the contract expects the user's UUID `id`.

## Where

`packages/nest-auth/src/lib/core/providers/phone-auth.provider.ts:43`

```ts
return {
  userId: identity.user?.phone,        // ← should be identity.user?.id
  // …
};
```

## Impact

Same as #003. Phone-based logins write the phone number into wherever `userId` is consumed, breaking session creation, audit logs, and any code that compares against `request.user.id`.

## Fix

```diff
- userId: identity.user?.phone,
+ userId: identity.user?.id,
```

## Verification

Walk phone-login end-to-end and assert `request.user.id` is a UUID.

## Related

- #003 (email-provider equivalent — fix together)
