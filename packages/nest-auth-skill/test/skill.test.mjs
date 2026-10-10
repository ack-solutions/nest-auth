// Structure of every skill: frontmatter, size budget, links, shared files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const skills = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')));
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const read = (...p) => fs.readFileSync(path.join(skillsDir, ...p), 'utf8');
const refsOf = (skill) => fs.readdirSync(path.join(skillsDir, skill, 'references')).filter((f) => f.endsWith('.md'));
const allText = (skill) => read(skill, 'SKILL.md') + refsOf(skill).map((r) => read(skill, 'references', r)).join('\n');

test('there is one skill per stack', () => {
  assert.deepEqual(skills.sort(), ['nest-auth', 'nest-auth-flutter', 'nest-auth-react']);
});

for (const skill of skills) {
  const text = read(skill, 'SKILL.md');
  const refs = refsOf(skill);

  test(`${skill}: valid Agent Skills frontmatter`, () => {
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    assert.ok(fm, 'frontmatter block');
    const name = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    const description = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    assert.equal(name, skill, 'name must equal the folder name');
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64);
    assert.ok(description && description.length <= 1024, 'description present and <= 1024 chars');
    assert.match(description, /Use when/i, 'description says when to use the skill');
    const keys = fm[1].split('\n').filter((l) => /^\w/.test(l)).map((l) => l.split(':')[0]);
    assert.deepEqual(keys.sort(), ['description', 'name'], 'only portable frontmatter keys');
  });

  test(`${skill}: SKILL.md stays small (progressive disclosure)`, () => {
    assert.ok(text.split('\n').length <= 120, `SKILL.md is ${text.split('\n').length} lines`);
    assert.ok(words(text) <= 1300, `SKILL.md is ${words(text)} words`);
  });

  test(`${skill}: every reference is linked and every link resolves`, () => {
    const linked = [...text.matchAll(/\]\((references\/[^)#\s]+)\)/g)].map((m) => m[1]);
    assert.ok(linked.length > 0);
    for (const l of linked) assert.ok(fs.existsSync(path.join(skillsDir, skill, l)), `missing ${l}`);
    for (const r of refs) assert.ok(linked.includes(`references/${r}`), `${r} is not linked from SKILL.md`);
  });

  test(`${skill}: references are focused and only point at files in the same skill`, () => {
    for (const r of refs) {
      const body = read(skill, 'references', r);
      assert.match(body, /^# \S/, `${r} starts with a title`);
      assert.ok(body.split('\n').length <= 220, `${r} is ${body.split('\n').length} lines`);
      for (const m of body.matchAll(/`([a-z-]+\.md)`/g)) {
        assert.ok(refs.includes(m[1]), `${skill}/${r} mentions ${m[1]}, which is not in this skill`);
      }
    }
  });

  test(`${skill}: leaves the choice to the user`, () => {
    assert.match(text, /user's instructions always win/i);
    assert.match(text, /## Requirements/);
    assert.match(text, /## Recommended defaults/);
    assert.match(text, /Also supported/);
  });

  test(`${skill}: no secrets or real-looking credentials`, () => {
    const all = allText(skill);
    assert.doesNotMatch(all, /secret:\s*['"][^'"]{8,}['"]/, 'hard-coded secret literal');
    assert.doesNotMatch(all, /eyJ[A-Za-z0-9_-]{20,}/, 'JWT literal');
  });
}

test('files shared between skills are identical copies', () => {
  const rest = skills.map((s) => read(s, 'references', 'rest-api.md'));
  assert.ok(rest.every((r) => r === rest[0]), 'rest-api.md differs between skills; copy the edited one to the others');
  assert.equal(read('nest-auth', 'references', 'client-js.md'), read('nest-auth-react', 'references', 'client-js.md'),
    'client-js.md differs between nest-auth and nest-auth-react');
});

test('each skill covers its stack', () => {
  const expect = {
    'nest-auth': ['NestAuthModule.forRoot', 'google', 'passwordless', 'mfa', 'accessTokenType', 'NestAuthRoles', 'NestAuthPermissions', 'TenantModeEnum', 'rateLimit', 'forRootAsync'],
    'nest-auth-react': ['AuthProvider', 'useNestAuth', 'AuthGuard', 'RequirePermission', 'createNextAuthHelpers', 'createNestAuthClient', 'verify2fa', 'switchTenant', 'passwordlessLogin'],
    'nest-auth-flutter': ['NestAuthClient', 'NestAuthController', 'SecureTokenStorage', 'signInWithGoogleIdToken', 'verifyMfa', 'passwordlessLogin', 'switchTenant', 'NestAuthException'],
  };
  for (const [skill, needles] of Object.entries(expect)) {
    const all = allText(skill);
    for (const n of needles) assert.ok(all.includes(n), `${skill} never mentions ${n}`);
  }
});

test('companion skills are cross-referenced by name, with the install command', () => {
  assert.match(read('nest-auth', 'SKILL.md'), /nest-auth-react/);
  assert.match(read('nest-auth', 'SKILL.md'), /nest-auth-flutter/);
  assert.match(read('nest-auth-react', 'SKILL.md'), /--stack backend/);
  assert.match(read('nest-auth-flutter', 'SKILL.md'), /--stack backend/);
});
