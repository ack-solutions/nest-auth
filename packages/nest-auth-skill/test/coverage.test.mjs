// Completeness: the skill must mention every public option, event, client
// method and React export. Read from the SOURCE, so adding a feature to the
// library without describing it in the skill fails this test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = path.resolve(pkgRoot, '..');
const skillsDir = path.join(pkgRoot, 'skills');
const skillDir = path.join(skillsDir, 'nest-auth');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const textOf = (skill) => {
  const dir = path.join(skillsDir, skill);
  return read(dir, 'SKILL.md') + fs.readdirSync(path.join(dir, 'references')).map((r) => read(dir, 'references', r)).join('\n');
};
// Client methods and React exports may be described in either JS skill.
const skillText = textOf('nest-auth') + textOf('nest-auth-react');
const mentions = (name) => new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(skillText);

/** Top-level property names of a TS interface body. */
function interfaceKeys(source, name) {
  const start = source.indexOf(`export interface ${name} {`);
  assert.ok(start !== -1, `interface ${name} not found`);
  const keys = [];
  let depth = 0;
  let inComment = false;
  for (const line of source.slice(start).split('\n').slice(1)) {
    const t = line.trim();
    if (t.startsWith('/*')) inComment = !t.includes('*/');
    else if (inComment) { if (t.includes('*/')) inComment = false; }
    else if (!t.startsWith('//') && !t.startsWith('*')) {
      if (depth === 0) {
        if (t === '}') break;
        const m = /^([A-Za-z_]\w*)\??\s*:/.exec(t);
        if (m) keys.push(m[1]);
      }
      depth += (t.match(/[{(]/g) || []).length - (t.match(/[})]/g) || []).length;
    }
  }
  return keys;
}

test('every module option is in config-reference.md', () => {
  const src = read(packages, 'nest-auth/src/lib/core/interfaces/auth-module-options.interface.ts');
  const keys = interfaceKeys(src, 'IAuthModuleOptions');
  assert.ok(keys.length > 25, `parsed only ${keys.length} options`);
  const table = read(skillDir, 'references', 'config-reference.md');
  const missing = keys.filter((k) => !table.includes(`\`${k}\``));
  assert.deepEqual(missing, [], 'options missing from config-reference.md');
});

test('every session and MFA option is described somewhere', () => {
  const session = interfaceKeys(read(packages, 'nest-auth/src/lib/core/interfaces/session-options.interface.ts'), 'SessionOptions');
  const missing = session.filter((k) => !mentions(k));
  assert.deepEqual(missing, [], 'session options never mentioned');
});

test('every auth event is listed', () => {
  const src = read(packages, 'nest-auth/src/lib/auth.constants.ts');
  const from = src.indexOf('export const NestAuthEvents = {');
  const body = src.slice(from, src.indexOf('} as const;', from));
  const names = [...body.matchAll(/^\s{4}([A-Z0-9_]+):/gm)].map((m) => m[1]);
  assert.ok(names.length > 30);
  const events = read(skillDir, 'references', 'advanced.md');
  const covered = (n) =>
    events.includes(n) ||
    // grouped rows such as `TENANT_*` or `USER_CREATED/UPDATED/DELETED`
    events.includes(`${n.split('_').slice(0, -1).join('_')}_*`) ||
    (n.startsWith('USER_') && events.includes('USER_CREATED/UPDATED/DELETED'));
  // Not emitted by the library yet (constant only), and admin-console internals.
  const exempt = new Set(['MAGIC_LINK_REQUESTED', 'ADMIN_CREATED', 'ADMIN_PASSWORD_RESET']);
  assert.deepEqual(names.filter((n) => !exempt.has(n) && !covered(n)), [], 'events missing from advanced.md');
});

test('every AuthClient method is mentioned', () => {
  const src = read(packages, 'nest-auth-client/src/client/auth-client.ts');
  const names = [...src.matchAll(/^ {4}(?:async )?([a-z][A-Za-z0-9]*)\(/gm)].map((m) => m[1]);
  const unique = [...new Set(names)].filter((n) => n !== 'constructor');
  assert.ok(unique.length > 40);
  // Low-level/introspection helpers an integrator does not need to be told about.
  const exempt = new Set(['setMode', 'getMode', 'getSession', 'getAuthHeadersSync', 'shouldSendCookies', 'getTokenState', 'onSessionVerified', 'onRefreshSessionData', 'setTenantId', 'getTenantId']);
  assert.deepEqual(unique.filter((n) => !exempt.has(n) && !mentions(n)), [], 'client methods never mentioned');
});

test('every React hook, guard and provider is mentioned', () => {
  const src = read(packages, 'nest-auth-react/src/index.ts');
  const names = [...src.matchAll(/export \{([^}]+)\}/g)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim())
    .filter((n) => /^(use[A-Z]|with[A-Z]|create[A-Z])\w+$|^(\w+Guard|\w+Provider|Require\w+)$/.test(n))
    .filter((n) => !/(Props|Config|Options|Helpers|Store)$/.test(n));
  assert.ok(names.length > 20);
  const exempt = new Set(['createRequireRoleHOC', 'createRequirePermissionHOC', 'createAccountSwitcherStore', 'useAccounts', 'useActiveAccount', 'useAuthHeaderFnSync', 'useMultiAccountEnabled']);
  assert.deepEqual(names.filter((n) => !exempt.has(n) && !mentions(n)), [], 'React exports never mentioned');
});

test('every nest_auth_flutter client method is mentioned in the Flutter skill', () => {
  const src = read(packages, 'nest_auth_flutter/lib/src/nest_auth_client.dart') + read(packages, 'nest_auth_flutter/lib/src/native_signin.dart');
  const names = [...new Set([...src.matchAll(/^\s+Future<[^\n]*?>\s+(?:get\s+)?([a-z][A-Za-z0-9]*)/gm)].map((m) => m[1]))].filter((n) => !n.startsWith('_'));
  assert.ok(names.length > 20, `parsed only ${names.length}`);
  const flutter = textOf('nest-auth-flutter');
  assert.deepEqual(names.filter((n) => !new RegExp(`\\b${n}\\b`).test(flutter)), [], 'Dart client methods never mentioned');
});

test('alternatives are offered wherever a recommendation is made', () => {
  const check = {
    'nest-auth': ['backend-setup.md', 'sessions-tokens.md', 'client-js.md', 'roles-permissions.md', 'security.md'],
    'nest-auth-react': ['setup.md', 'guards-and-roles.md', 'nextjs.md', 'auth-flows.md'],
    'nest-auth-flutter': ['setup.md', 'state-and-api.md', 'social-login.md', 'mfa.md'],
  };
  for (const [skill, files] of Object.entries(check)) {
    for (const r of files) {
      assert.match(read(skillsDir, skill, 'references', r), /Other ways|Another way|also works|Also available|Either|Variations|Optional/i, `${skill}/${r} offers no alternative`);
    }
  }
});
