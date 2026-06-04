---
id: 005
priority: P0
area: docs
status: fixed
package: '@ackplus/nest-auth-docs'
title: build-openapi.ts script is a stub — OpenAPI spec is hand-maintained
fixed-by: T-024
fixed-date: 2026-05-21
---

## Resolution (T-024, 2026-05-21)

`apps/docs/scripts/build-openapi.ts` now invokes the existing `packages/nest-auth/script/generate-nest-auth-swagger.mjs` generator (which boots NestAuthModule in-memory, runs `SwaggerModule.createDocument`, and writes to 4 destinations including `apps/docs/public/api/nest-auth.json`).

Verified end-to-end: `pnpm --filter @ackplus/nest-auth-docs run generate:openapi` regenerates the spec from live code.

## Summary

`apps/docs/scripts/build-openapi.ts` was added as part of the docs scaffold but never wired up. It logs a TODO note and exits without doing anything. The OpenAPI spec at `apps/docs/public/api/nest-auth.json` is therefore manually maintained and drifts whenever a controller or DTO changes upstream.

## Where

`apps/docs/scripts/build-openapi.ts:18-32`

```ts
async function main() {
  // TODO: replace with a real OpenAPI export from apps/example-nest
  // (or a dedicated nest-auth-docs-bootstrap entry point that builds the spec
  // without booting an HTTP listener).
  console.log(
    `OpenAPI spec at ${target} is currently the manually-checked-in copy.\n` +
      'Wire build-openapi.ts to apps/example-nest before launch.',
  );
  void writeFileSync;
}
```

## Impact

- Every API-reference page on the docs site (`/docs/api-reference/(generated)/...`) is built from this JSON. A stale spec means stale endpoint pages — wrong examples, missing fields, missing endpoints.
- The recent fix to `SocialCredentialsDto` (adding `type: 'idToken' | 'accessToken'`) had to be patched both in the source DTO and in the JSON file by hand.

## Fix hypothesis

Two viable approaches:

1. **Boot `apps/example-nest` headlessly.** Add a script entry that calls `NestFactory.createApplicationContext`, builds the Swagger document with `SwaggerModule.createDocument(...)`, writes it to `public/api/nest-auth.json`, and exits.

2. **Standalone bootstrap.** Add a `apps/docs/scripts/openapi-bootstrap.ts` that imports `NestAuthModule` and a minimal `AppModule` covering every feature (all OAuth providers, MFA, multi-tenant, admin-console enabled), boots, exports, exits.

Option 2 is preferable — `apps/example-nest` may not have every feature wired and `headlessly booting an example app` is fragile. The bootstrap script would be the single source of truth for "every endpoint we publish."

## Verification

- After wiring, deleting `public/api/nest-auth.json`, running `pnpm --filter @ackplus/nest-auth-docs generate:openapi`, and confirming the file is regenerated with the same shape.
- The endpoint-pages generator (`build-openapi-pages.ts`) keeps producing the same set of MDX files.
- A round-trip test in CI: regenerate the spec, then re-run `build-openapi-pages.ts`, then compare against committed output. Fail if drift.
