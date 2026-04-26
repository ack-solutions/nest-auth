/**
 * Generates a TypeDoc JSON snapshot from the contracts and backend packages
 * so the API Reference → Types page can render directly from source-of-truth
 * type definitions. Output goes to public/typedoc.json and is consumed by the
 * api-reference/types page.
 *
 * Run: pnpm --filter @ackplus/nest-auth-docs generate:typedoc
 */
import { Application, TSConfigReader } from 'typedoc';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..', '..');

async function main() {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [
      resolve(root, 'packages/nest-auth-contracts/src/index.ts'),
      resolve(root, 'packages/nest-auth/src/index.ts'),
      resolve(root, 'packages/nest-auth-client/src/index.ts'),
      resolve(root, 'packages/nest-auth-react/src/index.ts'),
    ],
    tsconfig: resolve(root, 'tsconfig.base.json'),
    excludeExternals: true,
    excludePrivate: true,
    excludeProtected: true,
    skipErrorChecking: true,
    json: resolve(import.meta.dirname, '..', 'public', 'typedoc.json'),
  });

  app.options.addReader(new TSConfigReader());

  const project = await app.convert();
  if (!project) {
    console.error('TypeDoc convert() returned no project');
    process.exit(1);
  }

  await app.generateJson(
    project,
    resolve(import.meta.dirname, '..', 'public', 'typedoc.json'),
  );

  console.log('TypeDoc snapshot written to public/typedoc.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
