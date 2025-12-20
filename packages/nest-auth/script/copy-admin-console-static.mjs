import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const sourceDir = join(
  packageRoot,
  'src',
  'lib',
  'admin-console',
  'static'
);
const targetDir = join(
  packageRoot,
  'dist',
  'lib',
  'admin-console',
  'static'
);

if (!existsSync(sourceDir)) {
  throw new Error(
    `Admin console static assets not found at ${sourceDir}. Run the UI build first.`
  );
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
console.log(`Copied admin console assets to ${targetDir}`);
