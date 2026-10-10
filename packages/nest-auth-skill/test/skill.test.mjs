// Structure of the skill itself: frontmatter, size budget, links.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'nest-auth');
const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const refs = fs.readdirSync(path.join(skillDir, 'references')).filter((f) => f.endsWith('.md'));
const words = (s) => s.split(/\s+/).filter(Boolean).length;

test('SKILL.md has valid Agent Skills frontmatter', () => {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(skill);
  assert.ok(fm, 'frontmatter block');
  const name = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim();
  const description = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim();
  assert.equal(name, path.basename(skillDir), 'name must equal the folder name');
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(name.length <= 64);
  assert.ok(description && description.length <= 1024, 'description present and <= 1024 chars');
  assert.match(description, /Use when/i, 'description says when to use the skill');
  const keys = fm[1].split('\n').filter((l) => /^\w/.test(l)).map((l) => l.split(':')[0]);
  assert.deepEqual(keys.sort(), ['description', 'name'], 'only portable frontmatter keys');
});

test('SKILL.md stays small (progressive disclosure)', () => {
  assert.ok(skill.split('\n').length <= 120, `SKILL.md is ${skill.split('\n').length} lines`);
  assert.ok(words(skill) <= 1200, `SKILL.md is ${words(skill)} words`);
});

test('every reference is linked from SKILL.md and every link resolves', () => {
  const linked = [...skill.matchAll(/\]\((references\/[^)#\s]+)\)/g)].map((m) => m[1]);
  assert.ok(linked.length > 0);
  for (const l of linked) assert.ok(fs.existsSync(path.join(skillDir, l)), `missing ${l}`);
  for (const r of refs) assert.ok(linked.includes(`references/${r}`), `${r} is not linked from SKILL.md`);
});

test('reference files are focused and self-describing', () => {
  for (const r of refs) {
    const text = fs.readFileSync(path.join(skillDir, 'references', r), 'utf8');
    assert.match(text, /^# \S/, `${r} starts with a title`);
    assert.ok(text.split('\n').length <= 220, `${r} is ${text.split('\n').length} lines`);
    // references point to each other by file name only (one level deep)
    for (const m of text.matchAll(/`([a-z-]+\.md)`/g)) {
      assert.ok(refs.includes(m[1]), `${r} mentions unknown reference ${m[1]}`);
    }
  }
});

test('the skill covers the supported feature set', () => {
  const all = skill + refs.map((r) => fs.readFileSync(path.join(skillDir, 'references', r), 'utf8')).join('\n');
  for (const needle of [
    'NestAuthModule.forRoot', 'google', 'github', 'facebook', 'apple', 'passwordless', 'mfa', 'TOTP',
    'accessTokenType', 'NestAuthRoles', 'NestAuthPermissions', 'TenantModeEnum', 'AuthProvider',
    'createNextAuthHelpers', 'nest_auth_flutter', 'createNestAuthClient', 'rateLimit',
  ]) {
    assert.ok(all.includes(needle), `skill never mentions ${needle}`);
  }
});

test('no secrets or real-looking credentials in the skill', () => {
  const all = skill + refs.map((r) => fs.readFileSync(path.join(skillDir, 'references', r), 'utf8')).join('\n');
  assert.doesNotMatch(all, /secret:\s*['"][^'"]{8,}['"]/, 'hard-coded secret literal');
  assert.doesNotMatch(all, /eyJ[A-Za-z0-9_-]{20,}/, 'JWT literal');
});
