# @ackplus/nest-auth-skill

## 2.13.1

### Patch Changes

- New package: `@ackplus/nest-auth-skill`, an AI coding skill for Nest Auth with a one-command installer.

  `npx @ackplus/nest-auth-skill` installs the skill for Claude Code (`.claude/skills/nest-auth`), Codex and other `AGENTS.md` agents (`.agents/skills/nest-auth` plus a marked block in `AGENTS.md`) and Cursor (`.cursor/rules/nest-auth.mdc`). It writes only agent instruction files and never installs or configures authentication in the application.
  - `install` / `update` are idempotent; files the developer edited are kept unless `--force` (a `.bak` copy is saved).
  - `validate` checks an installed copy; `uninstall` removes only what was installed.
  - The skill is a short `SKILL.md` plus one reference file per feature (backend setup, email/password, social login, passwordless, MFA, sessions, roles and permissions, multi-tenancy, JS client, React, Next.js, mobile, advanced). Every TypeScript example is compiled against the workspace packages in the test suite.
