// Installer behaviour, run against real temp directories. No mocks.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.mjs');
const SKILL = path.join('skills', 'nest-auth');

function project(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-auth-skill-'));
  for (const [f, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), content);
  }
  return dir;
}
function run(dir, args = [], env = {}) {
  const res = spawnSync(process.execPath, [cli, ...args, '--dir', dir], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: res.status, out: res.stdout + res.stderr };
}
function tree(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const has = (dir, f) => fs.existsSync(path.join(dir, f));

const APP = {
  'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^18.0.0' } }, null, 2),
  'src/main.ts': 'export const app = 1;\n',
};

test('fresh project: installs for every agent', () => {
  const dir = project(APP);
  const r = run(dir);
  assert.equal(r.code, 0, r.out);
  assert.ok(has(dir, `.claude/${SKILL}/SKILL.md`));
  assert.ok(has(dir, `.agents/${SKILL}/SKILL.md`));
  assert.ok(has(dir, `.agents/${SKILL}/references/backend-setup.md`));
  assert.match(read(dir, 'AGENTS.md'), /\.agents\/skills\/nest-auth\/SKILL\.md/);
  assert.match(read(dir, '.cursor/rules/nest-auth.mdc'), /alwaysApply: false/);
});

test('installing never changes the application', () => {
  const dir = project(APP);
  run(dir);
  assert.equal(read(dir, 'package.json'), APP['package.json'], 'package.json untouched');
  assert.equal(read(dir, 'src/main.ts'), APP['src/main.ts'], 'source untouched');
  assert.ok(!has(dir, 'node_modules'), 'nothing installed');
  const outside = tree(dir).filter((f) => !/^(\.claude|\.agents|\.cursor)\//.test(f) && !['AGENTS.md', 'package.json', 'src/main.ts'].includes(f));
  assert.deepEqual(outside, [], 'only agent instruction files were written');
});

test('detects the agents a project uses', () => {
  const dir = project({ ...APP, 'CLAUDE.md': '# rules\n' });
  const r = run(dir);
  assert.match(r.out, /\(claude\)/);
  assert.ok(has(dir, `.claude/${SKILL}/SKILL.md`));
  assert.ok(!has(dir, '.cursor'), 'no Cursor files in a non-Cursor project');
  assert.ok(!has(dir, 'AGENTS.md'));
});

test('--agent selects targets explicitly', () => {
  const dir = project(APP);
  run(dir, ['--agent', 'cursor']);
  assert.ok(has(dir, '.cursor/rules/nest-auth.mdc'));
  assert.ok(has(dir, `.agents/${SKILL}/SKILL.md`), 'the rule needs the shared copy');
  assert.ok(!has(dir, '.claude'));
  assert.equal(run(dir, ['--agent', 'vim']).code, 2, 'unknown agent is rejected');
});

test('re-running is idempotent', () => {
  const dir = project(APP);
  run(dir);
  const before = tree(dir).map((f) => [f, read(dir, f)]);
  const r = run(dir);
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.out, /installed|updated|created/);
  assert.deepEqual(tree(dir).map((f) => [f, read(dir, f)]), before);
});

test('AGENTS.md: existing content is preserved and the block is never duplicated', () => {
  const dir = project({ ...APP, 'AGENTS.md': '# My project\n\nUse pnpm.\n' });
  run(dir, ['--agent', 'codex']);
  run(dir, ['--agent', 'codex']);
  const text = read(dir, 'AGENTS.md');
  assert.ok(text.startsWith('# My project\n\nUse pnpm.\n'));
  assert.equal(text.split('nest-auth-skill:start').length - 1, 1);
  run(dir, ['uninstall']);
  assert.equal(read(dir, 'AGENTS.md'), '# My project\n\nUse pnpm.\n', 'uninstall restores the file');
});

test('update: pristine files are refreshed, edited files are kept', () => {
  const dir = project(APP);
  run(dir, ['--agent', 'claude']);
  const base = path.join(dir, '.claude', SKILL);
  const manifestFile = path.join(base, '.nest-auth-skill.json');
  // Simulate an older install: a pristine file with old content + a file that no longer ships.
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const sha = (s) => spawnSync(process.execPath, ['-e', `process.stdout.write(require('crypto').createHash('sha256').update(${JSON.stringify(s)}).digest('hex'))`], { encoding: 'utf8' }).stdout;
  fs.writeFileSync(path.join(base, 'references/mfa.md'), 'old mfa\n');
  manifest.files['references/mfa.md'] = sha('old mfa\n');
  fs.writeFileSync(path.join(base, 'references/gone.md'), 'retired\n');
  manifest.files['references/gone.md'] = sha('retired\n');
  manifest.version = '0.0.1';
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  // And a file the developer edited.
  fs.appendFileSync(path.join(base, 'SKILL.md'), '\nMy team note.\n');

  const r = run(dir, ['update', '--agent', 'claude']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /0\.0\.1 -> /);
  assert.notEqual(read(dir, `.claude/${SKILL}/references/mfa.md`), 'old mfa\n', 'pristine file updated');
  assert.ok(!has(dir, `.claude/${SKILL}/references/gone.md`), 'retired file removed');
  assert.match(read(dir, `.claude/${SKILL}/SKILL.md`), /My team note\./, 'edited file kept');
  assert.match(r.out, /kept .*SKILL\.md/);

  const forced = run(dir, ['update', '--agent', 'claude', '--force']);
  assert.equal(forced.code, 0);
  assert.doesNotMatch(read(dir, `.claude/${SKILL}/SKILL.md`), /My team note\./);
  assert.match(read(dir, `.claude/${SKILL}/SKILL.md.bak`), /My team note\./, 'a backup is kept');
});

test('a hand-written Cursor rule with the same name is not overwritten', () => {
  const dir = project({ ...APP, '.cursor/rules/nest-auth.mdc': 'my own rule\n' });
  const r = run(dir, ['--agent', 'cursor']);
  assert.equal(read(dir, '.cursor/rules/nest-auth.mdc'), 'my own rule\n');
  assert.match(r.out, /kept/);
});

test('--dry-run writes nothing', () => {
  const dir = project(APP);
  const r = run(dir, ['--dry-run']);
  assert.equal(r.code, 0);
  assert.match(r.out, /dry run/);
  assert.deepEqual(tree(dir), ['package.json', 'src/main.ts']);
});

test('validate: ok after install, fails when a file is missing, notes local edits', () => {
  const dir = project(APP);
  assert.equal(run(dir, ['validate']).code, 1, 'not installed');
  run(dir);
  assert.equal(run(dir, ['validate']).code, 0);

  fs.appendFileSync(path.join(dir, '.agents', SKILL, 'references/mfa.md'), 'x');
  const edited = run(dir, ['validate']);
  assert.equal(edited.code, 0);
  assert.match(edited.out, /edited locally: references\/mfa\.md/);

  fs.rmSync(path.join(dir, '.claude', SKILL, 'references/react.md'));
  const broken = run(dir, ['validate']);
  assert.equal(broken.code, 1);
  assert.match(broken.out, /missing file: references\/react\.md/);

  run(dir); // install repairs it
  assert.ok(has(dir, `.claude/${SKILL}/references/react.md`));
});

test('uninstall removes only what was installed', () => {
  const dir = project({ ...APP, '.claude/settings.json': '{}', '.cursor/rules/other.mdc': 'keep\n' });
  run(dir, ['--agent', 'all']);
  fs.writeFileSync(path.join(dir, '.claude', SKILL, 'references/mine.md'), 'my file\n');
  const r = run(dir, ['uninstall']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(tree(dir), [
    '.claude/settings.json',
    '.claude/skills/nest-auth/references/mine.md',
    '.cursor/rules/other.mdc',
    'package.json',
    'src/main.ts',
  ]);
});

test('--global installs under the home directory only', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-auth-home-'));
  const dir = project(APP);
  const r = run(dir, ['--global'], { HOME: home, USERPROFILE: home });
  assert.equal(r.code, 0, r.out);
  assert.ok(has(home, `.claude/${SKILL}/SKILL.md`));
  assert.ok(has(home, `.codex/${SKILL}/SKILL.md`));
  assert.deepEqual(tree(dir), ['package.json', 'src/main.ts'], 'project untouched');
  assert.equal(run(dir, ['validate', '--global'], { HOME: home, USERPROFILE: home }).code, 0);
});

test('help and version', () => {
  const dir = project();
  assert.match(run(dir, ['--help']).out, /Usage: npx @ackplus\/nest-auth-skill/);
  assert.match(run(dir, ['--version']).out, /^\d+\.\d+\.\d+/);
  assert.equal(run(dir, ['frobnicate']).code, 2);
});
