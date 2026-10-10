# @ackplus/nest-auth-skill

AI coding skills for [ACKPlus Nest Auth](https://ack-solutions.github.io/nest-auth/). Install once and your coding agent knows how to add authentication with the official Nest Auth SDKs: which package to use, which options to turn on, and what the real APIs look like.

Works with **Claude Code**, **Codex**, **Cursor** and any agent that reads `AGENTS.md` or the Agent Skills format.

## Install

Run in your project root:

```bash
npx @ackplus/nest-auth-skill
```

One command for every project. It reads `package.json` / `pubspec.yaml` (monorepo folders included) and installs only the skills that match your stack:

| Your project uses | Skill installed | Covers |
|---|---|---|
| NestJS | `nest-auth` | backend setup and every option, the plain JS/TS client, the REST API |
| React, Next.js, React Native / Expo | `nest-auth-react` | provider, hooks, guards, login/signup/MFA screens, Next.js server auth |
| Flutter | `nest-auth-flutter` | `nest_auth_flutter` client and controller, native sign-in, auth-gated navigation |

A full-stack monorepo gets all the skills it needs in one run. If nothing is recognised, all three are installed.

To choose yourself:

```bash
npx @ackplus/nest-auth-skill --stack react            # or --react
npx @ackplus/nest-auth-skill --stack flutter          # or --flutter
npx @ackplus/nest-auth-skill --stack backend,react    # several
npx @ackplus/nest-auth-skill --stack all
```

It also detects which agents the project uses and writes only agent instruction files:

| Agent | What is written |
|---|---|
| Claude Code | `.claude/skills/<skill>/` |
| Codex and other `AGENTS.md` agents | `.agents/skills/<skill>/` + a small marked block in `AGENTS.md` |
| Cursor | `.cursor/rules/<skill>.mdc` (points at `.agents/skills/<skill>/`) |

**It does not install or configure authentication.** No dependencies are added and no application file is touched. That only happens when you ask your agent.

Commit the generated files so your whole team (and CI agents) get the skills.

Flutter-only projects: the installer runs on Node.js (`npx`), which most Flutter machines have. Without Node, copy `skills/nest-auth-flutter` from this package into `.claude/skills/` or `.agents/skills/` by hand.

## Use

Ask your agent in plain language:

- "Add Google login to my React app."
- "Set up email/password authentication."
- "Add MFA to my existing login."
- "Make this application multi-tenant."
- "Add role-based permissions."
- "Add a login screen to my Flutter app."

The agent inspects your stack, reads only the reference files the task needs, and enables only what you asked for.

## Update, check, remove

```bash
npx @ackplus/nest-auth-skill@latest update     # same as install; safe to re-run
npx @ackplus/nest-auth-skill validate          # files present, unmodified, up to date
npx @ackplus/nest-auth-skill uninstall                # or: uninstall --stack flutter
```

`update` refreshes every skill already installed, plus any newly detected stack.

Updates are safe: files you have not touched are refreshed, files you edited are kept and reported. `--force` replaces them and saves your copy as `.bak`. Your own content in `AGENTS.md` is never changed, only the block between the `nest-auth-skill` markers.

## Options

```
--stack <list>   backend, react, flutter or all (default: detected from the project)
--agent <list>   claude, codex, cursor or all (default: detected agents, or all)
--dir <path>     project directory (default: current directory)
--global         install for your user (~/.claude/skills, ~/.codex/skills)
--force          overwrite files you edited (keeps a .bak)
--dry-run        show what would change
```

Requires Node.js 18+. The installer has no dependencies.

## What is in the skills

Each skill is a short `SKILL.md` plus reference files loaded on demand.

- **`nest-auth`**: backend setup, a full configuration reference, email/password, social login, passwordless/OTP, MFA, sessions and tokens, roles and permissions, multi-tenancy, security options, advanced configuration, the plain JS client, and the REST API.
- **`nest-auth-react`**: setup, auth flows, MFA, guards and role-based UI, tenancy, Next.js, React Native.
- **`nest-auth-flutter`**: setup, auth flows, social sign-in, MFA, state management and calling your own API.

**They recommend; they do not dictate.** Each skill tells the agent that your instructions always win. It separates what the library actually requires (a JWT secret, TypeORM, a listener that sends codes) from recommended defaults, and for every default it lists the other supported ways: cookie or header tokens, per-route or global guards, the SDK or raw REST calls, events or hooks, the built-in session store or your own. Ask for a specific approach and the agent uses it.

The skills are versioned and released with the Nest Auth packages. Keep them on the same version as the `@ackplus/nest-auth*` packages you use.

## Maintaining the skills (contributors)

- Source: `skills/<name>/`. Keep each `SKILL.md` short; put detail in `references/`.
- Every TypeScript example that imports an `@ackplus/*` package is compiled against the workspace packages. Dart examples are checked against the `nest_auth_flutter` source, and run through the real analyzer when Flutter is installed. Mark a block `nocheck` only when it needs something not installed here (Next.js, Expo, a Flutter plugin).
- A coverage test reads the library source and fails if a module option, event, client method, React export or Dart client method is not described. Add the description (or an explicit exemption with a reason) when you add a feature.
- `rest-api.md` and `client-js.md` exist in more than one skill so each skill works alone. They must stay identical; a test enforces it.
- `pnpm --filter @ackplus/nest-auth-skill test` runs everything.
