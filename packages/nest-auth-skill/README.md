# @ackplus/nest-auth-skill

An AI coding skill for [ACKPlus Nest Auth](https://ack-solutions.github.io/nest-auth/). Install it once and your coding agent knows how to add authentication with the official Nest Auth SDKs: which package to use, which options to turn on, and what the real APIs look like.

Works with **Claude Code**, **Codex**, **Cursor** and any agent that reads `AGENTS.md` or the Agent Skills format.

## Install

Run in your project root:

```bash
npx @ackplus/nest-auth-skill
```

That is all. It detects which agents the project uses and writes only agent instruction files:

| Agent | What is written |
|---|---|
| Claude Code | `.claude/skills/nest-auth/` |
| Codex and other `AGENTS.md` agents | `.agents/skills/nest-auth/` + a small marked block in `AGENTS.md` |
| Cursor | `.cursor/rules/nest-auth.mdc` (points at `.agents/skills/nest-auth/`) |

**It does not install or configure authentication.** No dependencies are added and no application file is touched. That only happens when you ask your agent.

Commit the generated files so your whole team (and CI agents) get the skill.

## Use

Ask your agent in plain language:

- "Add Google login to my React app."
- "Set up email/password authentication."
- "Add MFA to my existing login."
- "Make this application multi-tenant."
- "Add role-based permissions."

The agent inspects your stack, reads only the reference files the task needs, and enables only what you asked for.

## Update, check, remove

```bash
npx @ackplus/nest-auth-skill@latest update     # same as install; safe to re-run
npx @ackplus/nest-auth-skill validate          # files present, unmodified, up to date
npx @ackplus/nest-auth-skill uninstall
```

Updates are safe: files you have not touched are refreshed, files you edited are kept and reported. `--force` replaces them and saves your copy as `.bak`. Your own content in `AGENTS.md` is never changed, only the block between the `nest-auth-skill` markers.

## Options

```
--agent <list>   claude, codex, cursor or all (default: detected agents, or all)
--dir <path>     project directory (default: current directory)
--global         install for your user (~/.claude/skills, ~/.codex/skills)
--force          overwrite files you edited (keeps a .bak)
--dry-run        show what would change
```

Requires Node.js 18+. The installer has no dependencies.

## What is in the skill

A short `SKILL.md` (workflow, feature map, safety rules) and one reference file per feature, loaded on demand: backend setup, email/password, social login, passwordless/OTP, MFA, sessions and tokens, roles and permissions, multi-tenancy, the JS client, React, Next.js, mobile (React Native, Flutter) and advanced configuration.

The skill is versioned and released with the Nest Auth packages. Keep it on the same version as the `@ackplus/nest-auth*` packages you use.

## Maintaining the skill (contributors)

- Source: `skill/nest-auth/`. Keep `SKILL.md` short; put detail in `references/`.
- Every `ts`/`tsx` example that imports an `@ackplus/*` package is compiled against the workspace packages by `pnpm test`. If an API changes, the test fails until the example is fixed. Mark a block `nocheck` only when it needs a framework that is not installed here (Next.js, Expo).
- `pnpm --filter @ackplus/nest-auth-skill test` runs the structure, installer and example tests.
