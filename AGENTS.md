# AGENTS.md — `nest-auth` monorepo

> **Purpose** — orient an AI coding agent (Claude Code, Cursor, etc.) to this repo in one read.
> Per-package detail is in `packages/*/AGENTS.md`. Human-facing docs are at https://ack-solutions.github.io/nest-auth/.

## What this is

A monorepo for `@ackplus/nest-auth` — full-featured authentication for NestJS, JS, and React. Four packages, all released together at the same version.

| Package | Path | What it does |
| --- | --- | --- |
| `@ackplus/nest-auth-contracts` | `packages/nest-auth-contracts` | **Types only.** Shared DTOs, enums, domain interfaces. Zero runtime. |
| `@ackplus/nest-auth` | `packages/nest-auth` | **NestJS backend module.** Controllers, guards, decorators, services, hooks, embedded admin console UI. |
| `@ackplus/nest-auth-client` | `packages/nest-auth-client` | **Framework-agnostic JS client.** Calls the backend; handles tokens, refresh, MFA flows. |
| `@ackplus/nest-auth-react` | `packages/nest-auth-react` | **React layer.** Provider, hooks, guards, Next.js helpers. Wraps `nest-auth-client`. |
| `@ackplus/nest-auth-skill` | `packages/nest-auth-skill` | **AI agent skill + installer** (`npx @ackplus/nest-auth-skill`). One skill per stack in `skills/` (`nest-auth`, `nest-auth-react`, `nest-auth-flutter`). |

Build dependency order: **contracts → nest-auth → nest-auth-client → nest-auth-react**.

## Workspace conventions

- **Package manager:** `pnpm@10.21.0` (pinned in root `package.json`). Don't use npm/yarn.
- **Workspace layout:** `pnpm-workspace.yaml` includes `packages/*` and `apps/*`.
- **Build everything:** `pnpm build` (runs each package's build in dep order).
- **Build one:** `pnpm -C packages/nest-auth build` (or `pnpm nest-auth build` via root scripts).
- **Watch mode:** `pnpm watch` (parallel watch on all packages).
- **Docs site:** `pnpm --filter @ackplus/nest-auth-docs dev` → http://localhost:3000.
- **Example NestJS app:** `pnpm -C apps/example-nest start:dev`.

## Top-level layout

```
.
├── packages/
│   ├── nest-auth/              ← backend NestJS module
│   ├── nest-auth-client/       ← JS client
│   ├── nest-auth-react/        ← React layer
│   └── nest-auth-contracts/    ← shared types
├── apps/
│   ├── docs/                   ← Fumadocs site (Next.js + MDX)
│   ├── example-nest/           ← reference NestJS app
│   ├── example-react/          ← reference React SPA
│   └── examples-next/          ← reference Next.js App Router app
├── scripts/
│   └── publish.js              ← release script (prompted bump + publish)
├── .github/workflows/
│   ├── publish.yml             ← npm publish on tag push
│   └── docs.yml                ← GH Pages deploy on main push
├── .tasks/                     ← issue / TODO log (markdown files)
└── tsconfig.base.json
```

## Release process

- One version across every package: the npm packages and `nest_auth_flutter` on pub.dev.
- Every PR that changes a published package carries a changeset (`pnpm changeset`, in `.changeset/`). CI checks for it. The fixed group in `.changeset/config.json` keeps the npm packages on one version.
- To release, on an up-to-date `main` after the PRs are merged:
  1. `pnpm changeset version` consumes the changesets, bumps the packages and writes their `CHANGELOG.md`.
  2. Sync everything else to the same version `X`: `pnpm -r exec npm version X --no-git-tag-version --allow-same-version`, `version:` in `packages/nest_auth_flutter/pubspec.yaml`, and the `"version"` field of `apps/docs/public/api/nest-auth.json`, `apps/docs/src/data/openapi/nest-auth.json` and `packages/nest-auth-admin/src/data/nest-auth.json`.
  3. Add the release to `apps/docs/content/docs/changelog/index.mdx`, including its "Current stable" line.
  4. Commit as `chore(release): vX` and push `main`.
  5. Tag `main` HEAD with the **bare** version and push it: `git tag -a 2.15.0 -m 2.15.0 && git push origin 2.15.0`. This triggers `publish.yml`.
- **No `v` prefix on tags.** pub.dev's automated publishing only accepts a tag that matches the pubspec version, so a `v2.15.0` tag publishes to npm but fails the Flutter job.
- `publish.yml` refuses a tag that isn't `main` HEAD. `pnpm -r publish` skips versions already on npm, so pushing a corrected tag on the same commit only publishes what's missing.
- Pre-releases use a `-beta.N` suffix (npm dist-tag `beta`). Stable releases get `latest`.

## Conventions for an agent making changes

1. **Touch contracts first** when adding/changing a DTO or enum. Build in dep order; the backend and clients break at compile time if a contract changes.
2. **Keep `NestAuthUser` minimal.** It only holds auth fields. Any business field belongs on the consumer's `AppUser` (linked via `authUserId`). Reject PRs that bloat `NestAuthUser`.
3. **`@ApiProperty` on every public DTO field** — the OpenAPI spec at `apps/docs/public/api/nest-auth.json` is generated from these decorators. Missing `@ApiProperty` = invisible field in docs.
4. **Add an event for new lifecycle moments.** Don't leak side effects through hooks — hooks block the auth flow, events don't. Pick events for fan-out (email/audit/cache invalidation), hooks for gating.
5. **Don't break basePath.** Docs site runs under `/nest-auth` on GH Pages. Use `<Link>` (or the `MdxLink` shim) for internal hrefs; `fetch()` URLs need `${process.env.NEXT_PUBLIC_BASE_PATH}` prefix.
6. **Issue log lives in `.tasks/`** — see `.tasks/README.md` for format. New bugs/incomplete work should be filed there before fixing so the diff is reviewable.
7. **Keep the agent skill in step with the API.** When a public option, method or flow changes, update the matching skill in `packages/nest-auth-skill/skills/`. This includes the React and Flutter SDKs. Examples are compiled against the workspace packages, and a coverage test lists anything undocumented, by `pnpm --filter @ackplus/nest-auth-skill test`, so a stale example fails CI.

## Common pitfalls

- `synchronize: true` in `apps/example-nest`'s TypeORM config keeps adding columns when entities change. Use migrations in production setups.
- Forgetting `EventEmitterModule.forRoot()` in `AppModule` causes every `@OnEvent` listener to silently no-op. The docs setup-checklist page calls this out — keep it visible.
- `OpenAPI` spec at `apps/docs/public/api/nest-auth.json` is **manually maintained** until `apps/docs/scripts/build-openapi.ts` is wired to the live `apps/example-nest`. See `.tasks/`.
- `apps/docs/scripts/build-sql-snapshots.ts` is also a stub. Same `.tasks/` entry.

## Where the human docs are

https://ack-solutions.github.io/nest-auth/ — built from `apps/docs/`. Source: `apps/docs/content/docs/**/*.mdx`.

`apps/docs/AGENTS.md` exists for the docs site itself (Fumadocs config, generators, deploy).
