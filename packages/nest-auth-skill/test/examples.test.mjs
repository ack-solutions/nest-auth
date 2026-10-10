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
const skillDir = path.join(pkgRoot, 'skill', 'nest-auth');
const outDir = path.join(pkgRoot, 'test', '.tmp');
const require = createRequire(import.meta.url);

function blocks() {
  const out = [];
  const files = ['SKILL.md', ...fs.readdirSync(path.join(skillDir, 'references')).map((f) => `references/${f}`)];
  for (const file of files) {
    const text = fs.readFileSync(path.join(skillDir, file), 'utf8');
    const re = /^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm;
    let m;
    let n = 0;
    while ((m = re.exec(text))) {
      n++;
      out.push({ file, n, lang: m[1], info: m[2].trim(), code: m[3], line: text.slice(0, m.index).split('\n').length });
    }
  }
  return out;
}

const all = blocks();
const ts = all.filter((b) => b.lang === 'ts' || b.lang === 'tsx');
const checked = ts.filter((b) => /from '@ackplus\//.test(b.code) && !b.info.includes('nocheck'));

test('examples exist and most are compiled', () => {
  assert.ok(checked.length >= 20, `only ${checked.length} compiled examples`);
  const skipped = ts.filter((b) => b.info.includes('nocheck'));
  assert.ok(skipped.length <= 7, `${skipped.length} examples opt out of compilation`);
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
