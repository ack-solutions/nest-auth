import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const workspaceRoot = process.cwd();
const uiWorkspace = '@nest-auth/admin-console-ui';
const uiDir = join(workspaceRoot, 'packages', 'nest-auth', 'ui');
const uiDist = join(uiDir, 'dist');
const targetDir = join(
  workspaceRoot,
  'packages',
  'nest-auth',
  'src',
  'lib',
  'admin-console',
  'static'
);

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    ...options,
  });
}

function ensureDirs() {
  if (!existsSync(uiDir)) {
    throw new Error(
      `Admin console UI workspace not found at ${relative(workspaceRoot, uiDir)}`
    );
  }
}

function copyDist() {
  if (!existsSync(uiDist)) {
    throw new Error(
      `Admin console UI build output missing at ${relative(workspaceRoot, uiDist)}`
    );
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  // eslint-disable-next-line no-console
  console.log(
    `Copying admin console assets from ${relative(workspaceRoot, uiDist)} to ${relative(
      workspaceRoot,
      targetDir
    )}`
  );
  cpSync(uiDist, targetDir, { recursive: true });
}

function main() {
  ensureDirs();

  run(`yarn workspace ${uiWorkspace} build`, {
    cwd: workspaceRoot,
  });

  copyDist();
  // eslint-disable-next-line no-console
  console.log(
    `✔ Admin console assets copied to ${relative(workspaceRoot, targetDir)}`
  );
}

main();
