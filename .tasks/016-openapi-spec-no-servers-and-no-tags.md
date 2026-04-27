---
id: 016
priority: P2
area: backend
status: open
package: '@ackplus/nest-auth'
title: OpenAPI spec has empty servers[] and missing top-level tags[]
---

## Summary

The generated OpenAPI document at `apps/docs/public/api/nest-auth.json` has:

- `"servers": []` — Swagger UI / Redoc / OpenAPI Generator can't auto-populate a base URL.
- No top-level `tags` array — the docs site's endpoint-pages generator falls back to operation-level tags (which work, but the resulting groups have no descriptions).

I patched both fields manually as part of an earlier docs sweep, but the patches won't survive a regeneration once #005 lands.

## Where

The OpenAPI document is built by `@nestjs/swagger`'s `SwaggerModule.createDocument(app, config)` in (eventually) the `apps/docs/scripts/build-openapi.ts` flow (currently a stub — see #005). The `DocumentBuilder` chain probably looks like:

```ts
new DocumentBuilder()
  .setTitle('@ackplus/nest-auth API')
  .setVersion('2.0.0-beta')
  .build();
```

Missing:
- `.addServer('https://api.example.com', 'Production')` (or env-driven)
- `.addTag('Auth', 'Sign-up, login, sessions, password & verification flows.')`
- `.addTag('Mfa', 'Multi-factor authentication: TOTP, email/SMS OTP, recovery codes.')`
- `.addTag('Admin', '…')`

## Fix

Add `addServer` and `addTag` calls to the document builder used by the OpenAPI generation script (see #005). The SECTION_TAG_MAP in `apps/docs/app/api/search/route.ts` is a good source for the canonical tag names.

## Verification

- After #005 lands, regenerate the spec and confirm `servers[]` and `tags[]` are populated.
- Generated docs pages under `/docs/api-reference/(generated)/` group correctly without manual JSON patching.
