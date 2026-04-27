---
id: 007
priority: P1
area: backend
status: open
package: '@ackplus/nest-auth'
title: AdminUsersController endpoints have no @ApiResponse decorators
---

## Summary

The admin-users controller exposes ~9 endpoints (`@Get`, `@Post`, `@Patch`, `@Delete`) but none carry `@ApiResponse` decorators. The OpenAPI spec at `apps/docs/public/api/nest-auth.json` has these endpoints documented with empty/inferred response shapes, which means the auto-generated docs pages under `/docs/api-reference/(generated)/admin/...` won't ship full request/response details when the admin endpoints are added to the spec.

## Where

`packages/nest-auth/src/lib/admin-console/controllers/admin-users.controller.ts` — every handler.

Probable peers with the same gap:

- `admin-roles.controller.ts`
- `admin-permissions.controller.ts`
- `admin-tenants.controller.ts`

## Impact

- Admin-console endpoints are missing from the public OpenAPI spec or are present without typed responses.
- Docs pages can't render proper response schemas.
- Generated TypeScript clients (e.g. via `openapi-typescript`) won't know the admin response shape.

## Fix

Add `@ApiResponse({ status, description, type })` to every handler. Example:

```ts
@Get()
@ApiResponse({ status: 200, type: PaginatedAdminUserListResponseDto })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Insufficient role' })
async listUsers(@Query() query: AdminListUsersQueryDto) { … }
```

If a response DTO doesn't exist yet, declare one and decorate it.

## Verification

- `pnpm -C apps/example-nest start:dev` (or whatever bootstrap is used by the OpenAPI generator after #005 lands) and check the generated spec contains the admin endpoint schemas.
- Eyeball the resulting page at `/docs/api-reference/(generated)/admin/...` after running the page generator.
