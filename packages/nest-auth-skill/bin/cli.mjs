#!/usr/bin/env node
// Installer for the ACKPlus Nest Auth agent skill. Zero dependencies.
// It only writes agent instruction files. It never touches application code,
// package.json or lockfiles.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'nest-auth';
const SKILL_SRC = path.join(PKG_ROOT, 'skill', SKILL_NAME);
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
const MANIFEST = '.nest-auth-skill.json';
const AGENTS = ['claude', 'codex', 'cursor'];
const BLOCK_START = '<!-- nest-auth-skill:start -->';
const BLOCK_END = '<!-- nest-auth-skill:end -->';
const MANAGED_MARK = 'nest-auth-skill:managed';
const SHARED_DIR = path.join('.agents', 'skills', SKILL_NAME);

const HELP = `nest-auth-skill ${VERSION} — AI coding skill for ACKPlus Nest Auth

Usage: npx @ackplus/nest-auth-skill [command] [options]

Commands
  install     Install or update the skill (default). Safe to re-run.
  update      Same as install.
  validate    Check an installed skill: files present, unmodified, up to date.
  uninstall   Remove the skill files this tool installed.

Options
  --agent <list>   claude, codex, cursor or all (comma separated).
                   Default: agents detected in the project, or all if none.
  --dir <path>     Project directory. Default: current directory.
  --global         Install for the current user instead of one project
                   (~/.claude/skills and ~/.codex/skills).
  --force          Overwrite files you edited (a .bak copy is kept).
  --dry-run        Show what would change without writing.
  -v, --version    Print the version.
  -h, --help       Show this help.

Installing the skill does not add authentication to your app. Ask your agent,
for example: "Add Google login to my React app."`;

function parseArgs(argv) {
  const opts = { command: 'install', agents: null, dir: process.cwd(), global: false, force: false, dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.command = 'help';
    else if (a === '-v' || a === '--version') opts.command = 'version';
    else if (a === '--global' || a === '-g') opts.global = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--agent' || a === '--agents') opts.agents = argv[++i];
    else if (a.startsWith('--agent=')) opts.agents = a.slice(8);
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a.startsWith('--dir=')) opts.dir = a.slice(6);
    else if (a.startsWith('-')) fail(`Unknown option: ${a}\n\n${HELP}`);
    else rest.push(a);
  }
  if (rest.length > 1) fail(`Unexpected argument: ${rest[1]}`);
  if (rest[0] && !['help', 'version'].includes(opts.command)) {
    if (!['install', 'update', 'validate', 'uninstall', 'help'].includes(rest[0])) fail(`Unknown command: ${rest[0]}\n\n${HELP}`);
    opts.command = rest[0] === 'update' ? 'install' : rest[0];
  }
  if (opts.agents != null) {
    if (!opts.agents) fail('--agent needs a value: claude, codex, cursor or all');
    const list = opts.agents.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = list.filter((a) => a !== 'all' && !AGENTS.includes(a));
    if (bad.length) fail(`Unknown agent: ${bad.join(', ')}. Use claude, codex, cursor or all.`);
    opts.agents = list.includes('all') ? [...AGENTS] : [...new Set(list)];
  }
  if (!opts.dir) fail('--dir needs a path');
  opts.dir = path.resolve(opts.dir);
  return opts;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const exists = (p) => fs.existsSync(p);
const rel = (root, p) => path.relative(root, p) || '.';

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function detectAgents(root) {
  const found = [];
  if (exists(path.join(root, '.claude')) || exists(path.join(root, 'CLAUDE.md'))) found.push('claude');
  if (exists(path.join(root, 'AGENTS.md')) || exists(path.join(root, '.codex')) || exists(path.join(root, '.agents'))) found.push('codex');
  if (exists(path.join(root, '.cursor')) || exists(path.join(root, '.cursorrules'))) found.push('cursor');
  return found;
}

/** Skill directories for the chosen agents. codex and cursor share one copy. */
function skillDirs(opts, agents) {
  if (opts.global) {
    const home = os.homedir();
    const dirs = [];
    if (agents.includes('claude')) dirs.push(path.join(home, '.claude', 'skills', SKILL_NAME));
    if (agents.includes('codex')) dirs.push(path.join(home, '.codex', 'skills', SKILL_NAME));
    return dirs;
  }
  const dirs = [];
  if (agents.includes('claude')) dirs.push(path.join(opts.dir, '.claude', 'skills', SKILL_NAME));
  if (agents.includes('codex') || agents.includes('cursor')) dirs.push(path.join(opts.dir, SHARED_DIR));
  return dirs;
}

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8'));
    return m && typeof m.files === 'object' ? m : null;
  } catch {
    return null;
  }
}

class Report {
  constructor(root, dryRun) {
    this.root = root;
    this.dryRun = dryRun;
    this.lines = [];
    this.conflicts = [];
    this.changed = 0;
  }
  add(kind, file, note = '') {
    if (kind !== 'unchanged') this.changed++;
    this.lines.push(`  ${kind.padEnd(9)} ${rel(this.root, file)}${note ? `  (${note})` : ''}`);
  }
  conflict(file) {
    this.conflicts.push(file);
    this.lines.push(`  ${'kept'.padEnd(9)} ${rel(this.root, file)}  (you edited it; use --force to replace)`);
  }
}

function write(file, content, report) {
  if (report.dryRun) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function remove(file, report) {
  if (report.dryRun) return;
  fs.rmSync(file, { force: true });
}

function pruneEmptyDirs(dir, stopAt) {
  let cur = dir;
  while (cur.startsWith(stopAt) && cur !== stopAt && exists(cur) && fs.readdirSync(cur).length === 0) {
    fs.rmdirSync(cur);
    cur = path.dirname(cur);
  }
}

function installSkillDir(dir, opts, report) {
  const old = readManifest(dir);
  const files = listFiles(SKILL_SRC);
  const manifest = { name: SKILL_NAME, version: VERSION, files: {} };
  let verbose = [];

  for (const f of files) {
    const src = fs.readFileSync(path.join(SKILL_SRC, f));
    const dest = path.join(dir, f);
    const next = sha(src);
    if (!exists(dest)) {
      write(dest, src, report);
      manifest.files[f] = next;
      verbose.push(['added', dest]);
      continue;
    }
    const cur = sha(fs.readFileSync(dest));
    if (cur === next) {
      manifest.files[f] = next;
      continue;
    }
    const pristine = old?.files?.[f] === cur;
    if (pristine || opts.force) {
      if (!pristine && !report.dryRun) fs.copyFileSync(dest, `${dest}.bak`);
      write(dest, src, report);
      manifest.files[f] = next;
      verbose.push(['updated', dest, pristine ? '' : 'your copy saved as .bak']);
    } else {
      // Keep the user's edit. Record the hash we last shipped so it stays "edited".
      manifest.files[f] = old?.files?.[f] ?? next;
      report.conflict(dest);
    }
  }

  // Files from an older version that no longer ship.
  for (const f of Object.keys(old?.files ?? {})) {
    if (files.includes(f)) continue;
    const dest = path.join(dir, f);
    if (!exists(dest)) continue;
    if (sha(fs.readFileSync(dest)) === old.files[f] || opts.force) {
      remove(dest, report);
      verbose.push(['removed', dest]);
    } else {
      report.conflict(dest);
    }
  }

  const manifestFile = path.join(dir, MANIFEST);
  const body = JSON.stringify(manifest, null, 2) + '\n';
  const manifestChanged = !exists(manifestFile) || fs.readFileSync(manifestFile, 'utf8') !== body;
  if (manifestChanged) write(manifestFile, body, report);

  if (verbose.length === 0) {
    report.add('unchanged', dir, `v${VERSION}`);
  } else {
    const from = old?.version && old.version !== VERSION ? `${old.version} -> ${VERSION}` : `v${VERSION}`;
    report.add(old ? 'updated' : 'installed', dir, `${verbose.length} file(s), ${from}`);
    if (!report.dryRun) pruneEmptyDirs(path.join(dir, 'references'), dir);
  }
}

const agentsBlock = () => `${BLOCK_START}
## Nest Auth skill

For any authentication work (login, signup, social login, OTP/passwordless, MFA, sessions, roles and permissions, multi-tenancy) with ACKPlus Nest Auth (\`@ackplus/nest-auth\`), first read \`${SHARED_DIR.split(path.sep).join('/')}/SKILL.md\` and follow it. It links to feature-specific references; load only the ones the task needs.
${BLOCK_END}`;

function upsertAgentsBlock(root, report) {
  const file = path.join(root, 'AGENTS.md');
  const block = agentsBlock();
  if (!exists(file)) {
    write(file, block + '\n', report);
    return report.add('created', file);
  }
  const cur = fs.readFileSync(file, 'utf8');
  const start = cur.indexOf(BLOCK_START);
  const end = cur.indexOf(BLOCK_END);
  let next;
  if (start !== -1 && end > start) {
    next = cur.slice(0, start) + block + cur.slice(end + BLOCK_END.length);
  } else {
    next = cur.replace(/\s*$/, '') + '\n\n' + block + '\n';
  }
  if (next === cur) return report.add('unchanged', file);
  write(file, next, report);
  report.add('updated', file, 'managed block only');
}

function removeAgentsBlock(root, report) {
  const file = path.join(root, 'AGENTS.md');
  if (!exists(file)) return;
  const cur = fs.readFileSync(file, 'utf8');
  const start = cur.indexOf(BLOCK_START);
  const end = cur.indexOf(BLOCK_END);
  if (start === -1 || end < start) return;
  const next = (cur.slice(0, start).replace(/\s*$/, '') + '\n' + cur.slice(end + BLOCK_END.length).replace(/^\s*/, '\n')).replace(/^\s+$/, '');
  if (next.trim() === '') {
    remove(file, report);
    report.add('removed', file);
  } else {
    write(file, next.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n'), report);
    report.add('updated', file, 'managed block removed');
  }
}

const cursorRuleFile = (root) => path.join(root, '.cursor', 'rules', `${SKILL_NAME}.mdc`);
const cursorRule = () => `---
description: ACKPlus Nest Auth (@ackplus/nest-auth). Use for authentication work - login, signup, social login, OTP/passwordless, MFA, sessions, roles and permissions, multi-tenancy.
alwaysApply: false
---
<!-- ${MANAGED_MARK} - edits are overwritten by \`npx @ackplus/nest-auth-skill\` -->

Before any authentication work with ACKPlus Nest Auth, read \`${SHARED_DIR.split(path.sep).join('/')}/SKILL.md\` and follow it. It links to feature-specific references in the same folder; load only the ones the task needs.
`;

function upsertCursorRule(root, opts, report) {
  const file = cursorRuleFile(root);
  const next = cursorRule();
  if (!exists(file)) {
    write(file, next, report);
    return report.add('created', file);
  }
  const cur = fs.readFileSync(file, 'utf8');
  if (cur === next) return report.add('unchanged', file);
  if (!cur.includes(MANAGED_MARK) && !opts.force) return report.conflict(file);
  if (!cur.includes(MANAGED_MARK) && !report.dryRun) fs.copyFileSync(file, `${file}.bak`);
  write(file, next, report);
  report.add('updated', file);
}

function resolveAgents(opts) {
  if (opts.agents) return opts.agents;
  if (opts.global) return ['claude', 'codex'];
  const found = detectAgents(opts.dir);
  return found.length ? found : [...AGENTS];
}

function assertProjectDir(opts) {
  if (opts.global) return;
  if (!exists(opts.dir) || !fs.statSync(opts.dir).isDirectory()) fail(`Not a directory: ${opts.dir}`);
}

function install(opts) {
  assertProjectDir(opts);
  const agents = resolveAgents(opts);
  if (opts.global && agents.includes('cursor') && opts.agents) {
    console.log('Note: Cursor has no user-level skill folder; skipping it for --global.');
  }
  const root = opts.global ? os.homedir() : opts.dir;
  const report = new Report(root, opts.dryRun);

  for (const dir of skillDirs(opts, agents)) installSkillDir(dir, opts, report);
  if (!opts.global) {
    if (agents.includes('codex')) upsertAgentsBlock(opts.dir, report);
    if (agents.includes('cursor')) upsertCursorRule(opts.dir, opts, report);
  }

  console.log(`Nest Auth skill ${VERSION} — ${opts.dryRun ? 'dry run, nothing written' : 'done'} (${agents.join(', ')})`);
  console.log(report.lines.join('\n'));
  if (report.conflicts.length) {
    console.log(`\n${report.conflicts.length} file(s) you edited were kept. Re-run with --force to replace them (a .bak copy is saved).`);
  }
  if (!opts.dryRun) {
    console.log('\nNothing in your app was changed. Ask your agent, for example:\n  "Add Google login to my React app."');
  }
  return 0;
}

function findInstalled(opts) {
  const all = opts.global
    ? skillDirs({ ...opts }, ['claude', 'codex'])
    : skillDirs(opts, AGENTS);
  return all.filter((d) => exists(d));
}

function checkSkillDir(dir) {
  const problems = [];
  const notes = [];
  const manifest = readManifest(dir);
  if (!manifest) return { problems: ['missing or unreadable manifest; re-run install'], notes };
  const skillFile = path.join(dir, 'SKILL.md');
  if (!exists(skillFile)) problems.push('SKILL.md is missing');
  else {
    const text = fs.readFileSync(skillFile, 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm || !new RegExp(`^name:\\s*${SKILL_NAME}\\s*$`, 'm').test(fm[1]) || !/^description:\s*\S/m.test(fm[1])) {
      problems.push('SKILL.md frontmatter is invalid (needs name and description)');
    }
    for (const m of text.matchAll(/\]\((references\/[^)#\s]+)/g)) {
      if (!exists(path.join(dir, m[1]))) problems.push(`SKILL.md links to a missing file: ${m[1]}`);
    }
  }
  for (const [f, hash] of Object.entries(manifest.files)) {
    const p = path.join(dir, f);
    if (!exists(p)) problems.push(`missing file: ${f}`);
    else if (sha(fs.readFileSync(p)) !== hash) notes.push(`edited locally: ${f}`);
  }
  if (manifest.version !== VERSION) notes.push(`installed v${manifest.version}, this installer is v${VERSION}; run install to update`);
  return { problems, notes, version: manifest.version };
}

function validate(opts) {
  assertProjectDir(opts);
  const root = opts.global ? os.homedir() : opts.dir;
  const dirs = findInstalled(opts);
  if (!dirs.length) {
    console.log('Nest Auth skill is not installed here. Run: npx @ackplus/nest-auth-skill');
    return 1;
  }
  let bad = 0;
  for (const dir of dirs) {
    const { problems, notes, version } = checkSkillDir(dir);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${rel(root, dir)}${version ? `  v${version}` : ''}`);
    for (const p of problems) console.log(`       problem: ${p}`);
    for (const n of notes) console.log(`       note: ${n}`);
    if (problems.length) bad++;
  }
  if (!opts.global) {
    const shared = path.join(opts.dir, SHARED_DIR);
    const agentsFile = path.join(opts.dir, 'AGENTS.md');
    const hasBlock = exists(agentsFile) && fs.readFileSync(agentsFile, 'utf8').includes(BLOCK_START);
    const hasRule = exists(cursorRuleFile(opts.dir));
    if ((hasBlock || hasRule) && !exists(shared)) {
      console.log(`FAIL ${rel(root, shared)}  (AGENTS.md or the Cursor rule points here, but it is missing)`);
      bad++;
    }
  }
  console.log(bad ? '\nValidation failed. Run: npx @ackplus/nest-auth-skill install' : '\nValid.');
  return bad ? 1 : 0;
}

function uninstall(opts) {
  assertProjectDir(opts);
  const root = opts.global ? os.homedir() : opts.dir;
  const report = new Report(root, opts.dryRun);
  for (const dir of findInstalled(opts)) {
    const manifest = readManifest(dir);
    if (!manifest) {
      report.lines.push(`  ${'kept'.padEnd(9)} ${rel(root, dir)}  (no manifest; not installed by this tool)`);
      continue;
    }
    let kept = 0;
    for (const [f, hash] of Object.entries(manifest.files)) {
      const p = path.join(dir, f);
      if (!exists(p)) continue;
      if (sha(fs.readFileSync(p)) === hash || opts.force) remove(p, report);
      else {
        kept++;
        report.conflict(p);
      }
    }
    if (!kept) remove(path.join(dir, MANIFEST), report);
    if (!report.dryRun) {
      pruneEmptyDirs(path.join(dir, 'references'), root);
      pruneEmptyDirs(dir, root);
    }
    report.add('removed', dir, kept ? `${kept} edited file(s) kept` : '');
  }
  if (!opts.global) {
    removeAgentsBlock(opts.dir, report);
    const rule = cursorRuleFile(opts.dir);
    if (exists(rule)) {
      if (fs.readFileSync(rule, 'utf8').includes(MANAGED_MARK) || opts.force) {
        remove(rule, report);
        report.add('removed', rule);
        if (!report.dryRun) pruneEmptyDirs(path.dirname(rule), opts.dir);
      } else report.conflict(rule);
    }
  }
  console.log(`Nest Auth skill — ${opts.dryRun ? 'dry run, nothing removed' : 'uninstalled'}`);
  console.log(report.lines.length ? report.lines.join('\n') : '  nothing to remove');
  return 0;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.command === 'help') console.log(HELP);
else if (opts.command === 'version') console.log(VERSION);
else process.exit({ install, validate, uninstall }[opts.command](opts));
