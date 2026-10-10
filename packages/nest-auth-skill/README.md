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

A short `SKILL.md` and one reference file per topic, loaded on demand: backend setup, a full configuration reference, email/password, social login, passwordless/OTP, MFA, sessions and tokens, roles and permissions, multi-tenancy, security options, the JS client, React, Next.js, mobile (React Native, Flutter), the REST API for use without an SDK, and advanced configuration.

**It recommends; it does not dictate.** The skill tells the agent that your instructions always win. It separates what the library actually requires (a JWT secret, TypeORM, a listener that sends codes) from recommended defaults, and for every default it lists the other supported ways: cookie or header tokens, per-route or global guards, the SDK or raw REST calls, events or hooks, the built-in session store or your own. Ask for a specific approach and the agent uses it.

The skill is versioned and released with the Nest Auth packages. Keep it on the same version as the `@ackplus/nest-auth*` packages you use.

## Maintaining the skill (contributors)

- Source: `skill/nest-auth/`. Keep `SKILL.md` short; put detail in `references/`.
- Every `ts`/`tsx` example that imports an `@ackplus/*` package is compiled against the workspace packages by `pnpm test`. If an API changes, the test fails until the example is fixed. Mark a block `nocheck` only when it needs a framework that is not installed here (Next.js, Expo).
- A coverage test reads the library source and fails if a module option, event, client method or React export is not described in the skill. Add the description (or an explicit exemption with a reason) when you add a feature.
- `pnpm --filter @ackplus/nest-auth-skill test` runs the structure, coverage, installer and example tests.
