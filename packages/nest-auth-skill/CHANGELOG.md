# @ackplus/nest-auth-skill

## 2.16.0

## 2.15.0

## 2.14.1

## 2.14.0

## 2.13.1

### Patch Changes

- New package: `@ackplus/nest-auth-skill`, AI coding skills for Nest Auth with a one-command installer.

  `npx @ackplus/nest-auth-skill` detects the project's stack from `package.json` / `pubspec.yaml` (monorepo folders included) and installs the matching skills: `nest-auth` (NestJS backend, plain JS client, REST API), `nest-auth-react` (React, Next.js, React Native / Expo) and `nest-auth-flutter` (Flutter). `--stack backend|react|flutter|all` chooses explicitly.

  Skills are written for Claude Code (`.claude/skills/`), Codex and other `AGENTS.md` agents (`.agents/skills/` plus a marked block in `AGENTS.md`) and Cursor (`.cursor/rules/*.mdc`). Only agent instruction files are written; authentication is never installed or configured in the application.
  - `install` / `update` are idempotent; files the developer edited are kept unless `--force` (a `.bak` copy is saved).
  - `validate` checks installed copies; `uninstall` removes only what was installed (`--stack` for one skill).
  - Each skill is a short `SKILL.md` plus reference files loaded on demand. The skills recommend defaults and list the supported alternatives; the developer's instructions take precedence.
  - TypeScript examples are compiled against the workspace packages and Dart examples are checked against `nest_auth_flutter` in the test suite.
