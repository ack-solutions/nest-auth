---
id: 023
priority: P3
area: backend
mode: disabled
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: '@CurrentTenantId() returns null in disabled mode without JSDoc clarifying it'
---

> **Fixed.** Rewrote the JSDoc on `CurrentTenantId` to enumerate every
> case where it returns `null` (single-tenant deployment, public route,
> no-context-yet) and added a worked example showing the `null`-handling
> pattern. The return type was already `string | null` so consumers will
> get a TypeScript error if they assume non-null. `CurrentTenant` alias
> picked up an `{@link CurrentTenantId}` reference and a v3-removal note.
> Build verified clean.

## Summary

The `@CurrentTenantId()` decorator returns `request.tenantId ?? null`. In disabled-tenant mode, the request never has a `tenantId` populated, so consumers writing:

```ts
@Auth()
@Get()
list(@CurrentTenantId() tenantId: string) { … }
```

…get `null` at runtime even though the type says `string`. The TypeScript types lie about the contract.

## Where

`packages/nest-auth/src/lib/tenant/decorators/current-tenant.decorator.ts`

## Fix

Two-part:

1. **Type the return correctly.** It's `string | null`, not `string`:
   ```ts
   export const CurrentTenantId = createParamDecorator(
     (_, ctx): string | null => {
       const req = ctx.switchToHttp().getRequest();
       return req.tenantId ?? null;
     },
   );
   ```

   Force callers to `if (!tenantId) throw …` or use `??` defaults — TS will complain at compile time, which is the goal.

2. **Add a JSDoc note**:
   ```ts
   /**
    * Returns the active tenant ID for the request.
    *
    * - SHARED / ISOLATED mode + authenticated request: the user's active tenant ID.
    * - Disabled mode, OR public/optional-auth route with no session: `null`.
    *
    * Always check for null on routes that may run in disabled mode or under @Auth(true).
    */
   ```

## Verification

- TypeScript build of a consumer app that does `@CurrentTenantId() tenantId: string` should now error.
- `apps/example-nest` updated to demonstrate the correct pattern.
- The same review for `@CurrentTenant()`, `@CurrentUserAccess()`, `@CurrentMembership()` — they probably have the same lying type.

## Related

- #018 — disabled mode silently accepting tenantId from clients.
