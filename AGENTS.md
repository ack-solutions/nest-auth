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

- Version pinned across all four packages.
- Tag-based: `git tag v2.0.0-beta.27 && git push origin v2.0.0-beta.27` triggers `publish.yml`.
- Pre-stable releases use `-beta.N` suffix (npm dist-tag `beta`).
- Stable releases get `latest` dist-tag.

## Conventions for an agent making changes

1. **Touch contracts first** when adding/changing a DTO or enum. Build in dep order; the backend and clients break at compile time if a contract changes.
2. **Keep `NestAuthUser` minimal.** It only holds auth fields. Any business field belongs on the consumer's `AppUser` (linked via `authUserId`). Reject PRs that bloat `NestAuthUser`.
3. **`@ApiProperty` on every public DTO field** — the OpenAPI spec at `apps/docs/public/api/nest-auth.json` is generated from these decorators. Missing `@ApiProperty` = invisible field in docs.
4. **Add an event for new lifecycle moments.** Don't leak side effects through hooks — hooks block the auth flow, events don't. Pick events for fan-out (email/audit/cache invalidation), hooks for gating.
5. **Don't break basePath.** Docs site runs under `/nest-auth` on GH Pages. Use `<Link>` (or the `MdxLink` shim) for internal hrefs; `fetch()` URLs need `${process.env.NEXT_PUBLIC_BASE_PATH}` prefix.
6. **Issue log lives in `.tasks/`** — see `.tasks/README.md` for format. New bugs/incomplete work should be filed there before fixing so the diff is reviewable.

## Common pitfalls

- `synchronize: true` in `apps/example-nest`'s TypeORM config keeps adding columns when entities change. Use migrations in production setups.
- Forgetting `EventEmitterModule.forRoot()` in `AppModule` causes every `@OnEvent` listener to silently no-op. The docs setup-checklist page calls this out — keep it visible.
- `OpenAPI` spec at `apps/docs/public/api/nest-auth.json` is **manually maintained** until `apps/docs/scripts/build-openapi.ts` is wired to the live `apps/example-nest`. See `.tasks/`.
- `apps/docs/scripts/build-sql-snapshots.ts` is also a stub. Same `.tasks/` entry.

## Where the human docs are

https://ack-solutions.github.io/nest-auth/ — built from `apps/docs/`. Source: `apps/docs/content/docs/**/*.mdx`.

`apps/docs/AGENTS.md` exists for the docs site itself (Fumadocs config, generators, deploy).
