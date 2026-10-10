// Every TypeScript example in the skill is compiled against the REAL packages
// in this workspace, so an example cannot drift from the published API.
// A fenced block is compiled when it imports from an @ackplus package, unless
// its fence is marked `nocheck` (used only for framework-specific files whose
// own dependencies — next, expo — are not installed here).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(pkgRoot, 'skills');
const outDir = path.join(pkgRoot, 'test', '.tmp');
const require = createRequire(import.meta.url);

function blocks() {
  const out = [];
  for (const skill of fs.readdirSync(skillsDir)) {
    const dir = path.join(skillsDir, skill);
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
    const files = ['SKILL.md', ...fs.readdirSync(path.join(dir, 'references')).map((f) => `references/${f}`)];
    for (const rel of files) {
      const text = fs.readFileSync(path.join(dir, rel), 'utf8');
      const re = /^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm;
      let m;
      let n = 0;
      while ((m = re.exec(text))) {
        n++;
        out.push({ file: `${skill}/${rel}`, n, lang: m[1], info: m[2].trim(), code: m[3], line: text.slice(0, m.index).split('\n').length });
      }
    }
  }
  return out;
}

const all = blocks();
const ts = all.filter((b) => b.lang === 'ts' || b.lang === 'tsx');
const checked = ts.filter((b) => /from '@ackplus\//.test(b.code) && !b.info.includes('nocheck'));

test('examples exist and most are compiled', () => {
  assert.ok(checked.length >= 40, `only ${checked.length} compiled examples`);
  const skipped = ts.filter((b) => b.info.includes('nocheck'));
  assert.ok(skipped.length <= 8, `${skipped.length} examples opt out of compilation`);
});

test('@ackplus imports only use published entry points', () => {
  const allowed = new Set([
    '@ackplus/nest-auth', '@ackplus/nest-auth-client', '@ackplus/nest-auth-react',
    '@ackplus/nest-auth-react-native', '@ackplus/nest-auth-contracts',
  ]);
  for (const b of ts) {
    for (const m of b.code.matchAll(/from '(@ackplus\/[^']+)'/g)) {
      assert.ok(allowed.has(m[1]), `${b.file}:${b.line} imports ${m[1]} (deep imports are not public API)`);
    }
  }
});

test('nocheck examples still import only real exports', () => {
  // Names imported from packages we CAN resolve are verified even in nocheck blocks.
  const exportsOf = (name) => {
    const dts = require.resolve(name).replace(/\.(c?js)$/, '.d.ts');
    return fs.readFileSync(dts, 'utf8');
  };
  for (const b of ts.filter((x) => x.info.includes('nocheck'))) {
    for (const m of b.code.matchAll(/import\s*\{([^}]+)\}\s*from '(@ackplus\/nest-auth(?:-client|-react)?)'/g)) {
      const dts = exportsOf(m[2]);
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
        if (name) assert.match(dts, new RegExp(`\\b${name}\\b`), `${b.file}:${b.line} — ${m[2]} has no export ${name}`);
      }
    }
  }
});

test('every compiled example type-checks against the workspace packages', () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const index = new Map();
  for (const b of checked) {
    const name = `${b.file.replace(/[^a-z0-9]+/gi, '_')}_${b.n}.${b.lang === 'tsx' ? 'tsx' : 'ts'}`;
    fs.writeFileSync(path.join(outDir, name), b.code);
    index.set(name, b);
  }
  fs.writeFileSync(
    path.join(outDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx',
        strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
        experimentalDecorators: true, emitDecoratorMetadata: true,
        lib: ['ES2022', 'DOM'], types: ['node'], noUnusedLocals: false,
      },
      include: ['*.ts', '*.tsx'],
    }),
  );
  const tsc = require.resolve('typescript/bin/tsc');
  const res = spawnSync(process.execPath, [tsc, '-p', outDir, '--pretty', 'false'], { encoding: 'utf8' });
  const output = (res.stdout + res.stderr).replace(/^(\S+?)\((\d+),/gm, (line, f, l) => {
    const b = index.get(path.basename(f));
    return b ? `${b.file} (block at line ${b.line}, +${l})  [` + path.basename(f) + `](${l},` : line;
  });
  assert.equal(res.status, 0, `examples failed to compile:\n${output}`);
  fs.rmSync(outDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- Dart ------
const dart = all.filter((b) => b.lang === 'dart');
const flutterLib = path.resolve(pkgRoot, '..', 'nest_auth_flutter', 'lib');
const dartSource = fs.readdirSync(path.join(flutterLib, 'src')).map((f) => fs.readFileSync(path.join(flutterLib, 'src', f), 'utf8')).join('\n');

test('Dart examples only use members that exist in nest_auth_flutter', () => {
  assert.ok(dart.length >= 12, `only ${dart.length} Dart examples`);
  // Every public member declared in the SDK source.
  const declared = new Set([...dartSource.matchAll(/\b([a-z][A-Za-z0-9]*)\s*(?:\(|=>|\{|;|async)/g)].map((m) => m[1]));
  const getters = new Set([...dartSource.matchAll(/\bget\s+([a-z][A-Za-z0-9]*)/g)].map((m) => m[1]));
  const types = new Set([...dartSource.matchAll(/\b(?:class|enum|extension)\s+([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]));
  for (const b of dart) {
    // calls and property reads on the SDK objects used throughout the skill
    for (const m of b.code.matchAll(/\b(?:auth\.client|authClient|client|auth|widget\.auth)\.([a-z][A-Za-z0-9]*)/g)) {
      const name = m[1];
      if (name === 'client') continue;
      assert.ok(declared.has(name) || getters.has(name), `${b.file}:${b.line} uses .${name}, which nest_auth_flutter does not declare`);
    }
    // SDK types
    for (const m of b.code.matchAll(/\b(NestAuth[A-Za-z]*|SecureTokenStorage|InMemoryTokenStorage|TokenStorage|AuthStatus|AuthResponse|SessionUser|TokenPair)\b/g)) {
      assert.ok(types.has(m[1]), `${b.file}:${b.line} uses type ${m[1]}, which nest_auth_flutter does not declare`);
    }
    // named arguments of client calls must be parameters of that method
    for (const m of b.code.matchAll(/\.([a-z][A-Za-z0-9]*)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      const sig = new RegExp(`\\b${m[1]}\\(([\\s\\S]*?)\\)\\s*(?:=>|async|\\{)`).exec(dartSource);
      if (!sig || !declared.has(m[1]) || ['login', 'signup'].includes(m[1]) === false && !/Future</.test(dartSource.slice(Math.max(0, sig.index - 60), sig.index))) continue;
      for (const arg of m[2].matchAll(/(?:^|[,(]\s*)([a-z][A-Za-z0-9]*):/g)) {
        assert.ok(new RegExp(`\\b${arg[1]}\\b`).test(sig[1]) || dartSource.includes(` ${arg[1]},`) || dartSource.includes(`this.${arg[1]}`),
          `${b.file}:${b.line} passes ${arg[1]}: to ${m[1]}(), which has no such parameter`);
      }
    }
  }
});

test('Dart examples pass the real analyzer (when Flutter is installed)', (t) => {
  const has = spawnSync('flutter', ['--version'], { encoding: 'utf8' });
  if (has.error || has.status !== 0) return t.skip('flutter is not installed');
  const dir = path.join(outDir, 'dart');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pubspec.yaml'),
    `name: skill_examples\npublish_to: none\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\n  flutter: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\n  nest_auth_flutter:\n    path: ${path.resolve(flutterLib, '..')}\n`);
  const names = new Map();
  for (const b of dart.filter((x) => !x.info.includes('nocheck'))) {
    const name = `${b.file.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${b.n}.dart`;
    fs.writeFileSync(path.join(dir, 'lib', name), b.code);
    names.set(name, b);
  }
  let get = spawnSync('flutter', ['pub', 'get', '--offline'], { cwd: dir, encoding: 'utf8' });
  if (get.status !== 0) get = spawnSync('flutter', ['pub', 'get'], { cwd: dir, encoding: 'utf8' });
  if (get.status !== 0) return t.skip('flutter pub get failed (offline?)');
  const res = spawnSync('dart', ['analyze', '--fatal-infos'], { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, `Dart examples failed analysis:\n${res.stdout}${res.stderr}`);
  fs.rmSync(outDir, { recursive: true, force: true });
});
