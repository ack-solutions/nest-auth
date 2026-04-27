---
id: 002
priority: P0
area: backend
status: open
package: '@ackplus/nest-auth'
title: Plaintext admin password logged to stdout
---

## Summary

`AdminAuthService.validateCredentials` calls `console.log('admin', password)` on every admin-login attempt, dumping the **plaintext password** into stdout.

## Where

`packages/nest-auth/src/lib/admin-console/services/admin-auth.service.ts:23`

```ts
console.log('admin', password);
```

## Impact

- Any log aggregator (Datadog, Loggly, CloudWatch, your terminal) now sees plaintext admin credentials.
- Even debug-mode logging would be wrong — passwords should never be logged at any level.
- Compounded with #001, this is a complete admin-console takeover vector.

## Fix

Delete the line. The library has a `DebugLoggerService` for any operational logging that's actually needed, but passwords should never reach it.

```diff
- console.log('admin', password);
  const valid = await admin.validatePassword(password);
```

## Verification

- Grep `packages/nest-auth/src/` for `console.log` and confirm no other plaintext-credential leaks.
- Add an ESLint rule (or a test) that fails on `console.log` in `src/lib/admin-console/**` to prevent regression.
