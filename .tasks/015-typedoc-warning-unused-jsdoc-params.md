---
id: 015
priority: P3
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: TypeDoc warns about JSDoc `@param` references to unused parameters
---

> **Fixed.** Both stale JSDoc blocks rewritten to match the actual signatures:
> - `IRegistrationHooks.beforeSignup` — JSDoc + `@example` now reflect `(input, context)` instead of the bogus `(request, input)` shape.
> - `GoogleAuthProvider.validate` — `@param config` removed; `_tenantId` documented as deliberately unused with reasoning. TypeDoc no longer warns about either.

## Summary

Running `pnpm --filter @ackplus/nest-auth-docs generate:typedoc` emits two warnings:

```
[warning] The signature nest-auth/src.IRegistrationHooks.beforeSignup.__type
          has an @param with name "request", which was not used
[warning] The signature nest-auth/src.GoogleAuthProvider.validate
          has an @param with name "config", which was not used
```

## Where

- `packages/nest-auth/src/lib/core/interfaces/auth-module-options.interface.ts` — `IRegistrationHooks.beforeSignup` JSDoc references a `request` parameter the function signature doesn't declare.
- `packages/nest-auth/src/lib/core/providers/google-auth.provider.ts:39-46` — `validate` JSDoc references `@param config` but the implementation uses `_tenantId` (and ignores it).

## Impact

Cosmetic — but the warnings clutter the docs build log and indicate stale/incorrect JSDoc that consumers reading the source will trust.

## Fix

For each warning:
1. Decide whether the parameter *should* exist (e.g. is `request` actually passed to `beforeSignup` and just missing from the type?).
2. Either add the parameter to the function signature, or update the JSDoc to drop the stale `@param` line.

For the Google provider's `_tenantId`: rename to `tenantId` and use it (Google identities are global, but the parameter is part of the provider contract — if it's truly unused, document why).

## Verification

- `pnpm --filter @ackplus/nest-auth-docs generate:typedoc` produces no warnings about unused `@param`.
