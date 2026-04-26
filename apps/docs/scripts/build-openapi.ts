/**
 * Refreshes public/api/nest-auth.json with the OpenAPI spec from the example
 * NestJS app. The example app boots NestAuthModule with all features enabled,
 * so the generated spec covers every endpoint Nest Auth ships.
 *
 * Run: pnpm --filter @ackplus/nest-auth-docs generate:openapi
 *
 * Implementation is a stub for now — wire it up to either:
 *   1. Boot apps/example-nest with ApplicationConfig.NEST_AUTH_DOCS=1 and
 *      hit /api-json, OR
 *   2. Call SwaggerModule.createDocument(...) statically without booting the
 *      HTTP server (faster, deterministic).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(
  import.meta.dirname,
  '..',
  'public',
  'api',
  'nest-auth.json',
);

async function main() {
  // TODO: replace with a real OpenAPI export from apps/example-nest
  // (or a dedicated nest-auth-docs-bootstrap entry point that builds the spec
  // without booting an HTTP listener).
  console.log(
    `OpenAPI spec at ${target} is currently the manually-checked-in copy.\n` +
      'Wire build-openapi.ts to apps/example-nest before launch.',
  );
  // Leave the existing file in place — it's already a working spec.
  void writeFileSync;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
