/**
 * Refreshes public/api/nest-auth.json with the OpenAPI spec from the live
 * NestAuthModule. The real generator lives in the backend package — this script
 * just ensures the package is built first and then invokes it.
 *
 * The generator boots NestAuthModule in-memory with `adminConsole.enabled: false`,
 * runs SwaggerModule.createDocument, and writes the spec to 4 destinations:
 *   1. apps/docs/public/api/nest-auth.json   (← this script's target)
 *   2. apps/docs/src/data/openapi/nest-auth.json
 *   3. packages/nest-auth-admin/src/data/nest-auth.json   (admin UI consumes)
 *   4. packages/nest-auth/dist/lib/admin-console/static/nest-auth.json
 *
 * Run: pnpm --filter @ackplus/nest-auth-docs generate:openapi
 *
 * Closes .tasks/005-build-openapi-script-is-stub.md (T-024).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const NEST_AUTH_PKG = resolve(REPO_ROOT, 'packages', 'nest-auth');
const NEST_AUTH_DIST = resolve(NEST_AUTH_PKG, 'dist', 'index.js');
const GENERATOR = resolve(NEST_AUTH_PKG, 'script', 'generate-nest-auth-swagger.mjs');
const TARGET = resolve(import.meta.dirname, '..', 'public', 'api', 'nest-auth.json');

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd ?? REPO_ROOT });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function main() {
  console.log('[build-openapi] Step 1/2: Building @ackplus/nest-auth (required for generator)…');
  if (!existsSync(NEST_AUTH_DIST)) {
    run('pnpm', ['-F', '@ackplus/nest-auth', 'build']);
  } else {
    console.log('  ✓ dist already exists; skipping rebuild (run with --force to rebuild)');
  }

  console.log('[build-openapi] Step 2/2: Running swagger generator…');
  run('node', [GENERATOR], { cwd: NEST_AUTH_PKG });

  if (!existsSync(TARGET)) {
    throw new Error(`Generator did not write expected target: ${TARGET}`);
  }
  console.log(`[build-openapi] ✓ OpenAPI spec refreshed at ${TARGET}`);
}

main().catch((err) => {
  console.error('[build-openapi] FAILED:', err.message);
  process.exit(1);
});
