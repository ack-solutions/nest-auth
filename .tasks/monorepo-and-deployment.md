---
id: monorepo-and-deployment
priority: P0
area: monorepo
status: open
package: monorepo
title: Monorepo audit + reorganization + Vercel deployment plan
---

## Summary

Two questions answered:

1. **Is the monorepo architecture correct?** Mostly OK at the workspace level, but with 13 concrete issues that hurt day-to-day development. Fixes are mechanical; do them in Phase 1 before any other refactor.
2. **Can examples deploy to Vercel?** Three of four can — directly. The fourth (NestJS backend) should NOT go on Vercel — use Railway/Render. Concrete deploy plan below.

This doc complements [`000-master-roadmap.md`](000-master-roadmap.md). Treat it as **Phase 0** — finish this before Phase 1 of the roadmap.

---

## Part 1 — Monorepo audit

### 1.1 What's working

| ✅ | Detail |
|---|---|
| pnpm workspace | Pinned to `pnpm@10.21.0` via `packageManager` field |
| Sensible split | `packages/*` (publishable libs) + `apps/*` (demos/docs) |
| Root TS base config | `tsconfig.base.json` shared |
| GH Actions wired | `publish.yml` (tag-based npm publish), `docs.yml` (GH Pages) |
| Per-package scripts | Each package has `build`, `watch`, `lint`, `format`, `clean` |
| Build order | Documented in root `build` script |

### 1.2 What's broken — 13 concrete issues

| # | Issue | Impact | Severity |
|---|---|---|---|
| M1 | **No build orchestrator.** Root script hard-codes `pnpm nest-auth-contracts build && pnpm nest-auth build && ...`. No caching. No parallel builds where graph allows. Every CI run rebuilds everything. | Slow CI, slow local dev | P0 |
| M2 | **Embedded UI uses npm + has both lockfiles.** `packages/nest-auth/ui/` has `package-lock.json` AND `yarn.lock`. Root postinstall calls `npm --prefix packages/nest-auth/ui install`. Mixed package managers in the same repo. | Unpredictable installs, broken CI on different machines | P0 |
| M3 | **Embedded UI not in workspace.** `pnpm-workspace.yaml` lists `packages/*` and `apps/*` only — the UI's `ui/` subfolder is invisible to pnpm. Can't share deps. | Duplicate React/MUI installations | P1 |
| M4 | **No test infrastructure anywhere.** No Vitest/Jest config, no `test/` folder structured, no CI test step. (Already tracked as [`.tasks/013`](013-no-test-coverage-on-any-package.md) but listed here for completeness.) | 0% coverage | P0 |
| M5 | **TypeScript settings are half-strict.** `strictNullChecks: false`, `noImplicitAny: false`, `strictBindCallApply: false` in `tsconfig.base.json`. You get TS without the type safety. | Silent runtime bugs | P0 |
| M6 | **No shared dev configs.** No `tools/` or `configs/` folder. Each package has its own ESLint/Prettier setup (or none). Style drift is inevitable. | Inconsistent code style | P1 |
| M7 | **No Changesets** (or equivalent). Versions managed by tag pushes only. No automated changelog. Beta releases are ad-hoc. | Hard to track what changed when | P1 |
| M8 | **Naming inconsistency.** `examples-next` (plural) vs `example-react` / `example-nest` (singular). `apps/example-nest`'s `package.json` declares `name: "example-app"` — doesn't match folder name. | Confusion in scripts and docs | P2 |
| M9 | **Awkward TS build invocation.** `pnpm -C ../.. exec tsc -p packages/nest-auth/tsconfig.build.json` reaches back up to root because nest-auth depends on root-level `node_modules`. Should use TypeScript Project References instead. | Slow incremental builds | P1 |
| M10 | **`apps/example-nest`'s lint script references `apps/libs/`** (`eslint "{src,apps,libs,test}/**/*.ts"`) — a path that doesn't exist. Migration leftover. | Lint silently does nothing extra | P3 |
| M11 | **No Node engine pinned** in any `package.json`. Consumers can install on Node 14 and break at runtime. | Mysterious bug reports | P2 |
| M12 | **No `.nvmrc` / `.tool-versions`.** Contributors don't know which Node version to use. | Onboarding friction | P2 |
| M13 | **Mixed build outputs.** `nest-auth-contracts` uses `tsup`; others use raw `tsc`. Output shapes (CJS+ESM dual, .d.ts placement) might differ across packages. | Subtle consumer breakage | P1 |

### 1.3 Reorganization plan

The fix is structural, but small in code. Result:

```
nest-auth/                          ← repo root
├── package.json                    ← workspace + Turborepo scripts only
├── pnpm-workspace.yaml             ← includes packages/*, apps/*, tools/*
├── pnpm-lock.yaml
├── turbo.json                      ← NEW: task graph + caching
├── tsconfig.base.json              ← strict mode ON
├── .nvmrc                          ← NEW: pin Node version
├── .npmrc                          ← NEW: hoist + lock-file settings
├── .changeset/                     ← NEW: version + changelog automation
│   └── config.json
├── .github/workflows/
│   ├── ci.yml                      ← NEW: build + test + lint matrix
│   ├── publish.yml                 ← upgraded: changesets-driven
│   └── docs.yml
│
├── tools/                          ← NEW: shared dev configs (workspace pkgs)
│   ├── eslint-config/              ← @ackplus/eslint-config
│   ├── tsconfig/                   ← @ackplus/tsconfig (lib, app, vite presets)
│   ├── prettier-config/            ← @ackplus/prettier-config
│   └── vitest-preset/              ← @ackplus/vitest-preset (real-test helpers)
│
├── packages/                       ← publishable libraries
│   ├── nest-auth/                  ← backend (UI extracted)
│   ├── nest-auth-client/
│   ├── nest-auth-react/
│   ├── nest-auth-contracts/
│   └── nest-auth-admin/            ← NEW: was packages/nest-auth/ui/
│       ├── package.json            ← single lockfile, pnpm-managed
│       ├── src/server/             ← backend pieces (controllers, entities)
│       └── src/ui/                 ← Vite/React SPA
│
├── apps/                           ← non-publishable demos + docs
│   ├── docs/                       ← Fumadocs Next.js site
│   ├── example-nest/               ← backend demo  (renamed package.json)
│   ├── example-nest-multitenant/   ← NEW per master roadmap §7.2
│   ├── example-react/              ← Vite SPA demo
│   ├── example-next/               ← renamed from examples-next
│   ├── example-vanilla/            ← NEW
│   ├── example-plugin-custom-oauth/← NEW (plugin authoring)
│   └── example-plugin-extra-field/ ← NEW
│
└── .tasks/                         ← issue log
```

### 1.4 Concrete changes — file by file

#### M1, M9 — Add Turborepo

```bash
pnpm add -Dw turbo@latest
```

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "inputs": ["src/**", "tsconfig*.json", "package.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**", "vitest.config.ts"]
    },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

Root `package.json` scripts become:

```json
{
  "scripts": {
    "build": "turbo run build",
    "test":  "turbo run test",
    "lint":  "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev":   "turbo run dev --parallel"
  }
}
```

**Result:** parallel builds where graph allows, content-hash caching, incremental rebuilds.

#### M2, M3 — Extract embedded UI to its own workspace package

```bash
# move
git mv packages/nest-auth/ui packages/nest-auth-admin

# clean up
cd packages/nest-auth-admin
rm yarn.lock package-lock.json node_modules -rf
```

Update `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools/*"
```

Remove the `postinstall: npm --prefix packages/nest-auth/ui install` line from root `package.json`. Now everything installs via pnpm with one lockfile.

In `packages/nest-auth/package.json`, drop the `start:ui`, `build:ui`, and `--prefix ui` invocations. The backend pulls the prebuilt admin bundle from `@ackplus/nest-auth-admin/dist/ui` via workspace symlink.

#### M5 — Turn on strict TypeScript

`tsconfig.base.json` (target after migration; do it gradually if needed):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2023",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "incremental": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  }
}
```

Then `tools/tsconfig/lib.json` (extends base, plus library-specific options); `tools/tsconfig/app.json`; `tools/tsconfig/vite.json`. Each package extends the right preset.

**Migration order for strict mode:**
1. Turn it on in `tools/tsconfig/base.json`.
2. Build each package; expect ~50-200 errors per package.
3. Fix package-by-package; commit per package so PRs stay reviewable.

#### M6 — Shared dev configs in `tools/`

Each entry in `tools/` is a workspace package. Example:

`tools/eslint-config/package.json`:
```json
{
  "name": "@ackplus/eslint-config",
  "version": "0.0.0",
  "main": "index.js",
  "type": "module"
}
```

`tools/eslint-config/index.js`:
```js
export default [
  // shared rules
];
```

Consumed by every package's `eslint.config.js`:
```js
import config from '@ackplus/eslint-config';
export default config;
```

Same pattern for `prettier-config`, `tsconfig`, `vitest-preset`. `vitest-preset` is where the Testcontainers helpers from [`test-catalog.md`](test-catalog.md) live, so every package imports the same boot helper.

#### M7 — Changesets

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

Workflow:
- Developer makes a change → runs `pnpm changeset` → picks affected packages + bump type + description.
- File committed alongside the PR.
- On merge to main, a GH Action opens a "Version Packages" PR aggregating pending changesets.
- Merge that PR → publishes new versions + updates `CHANGELOG.md` per package.

Replaces the manual tag-push flow. All four packages still version-locked via the `fixed` group:

```json
// .changeset/config.json
{
  "fixed": [["@ackplus/nest-auth", "@ackplus/nest-auth-client", "@ackplus/nest-auth-react", "@ackplus/nest-auth-contracts", "@ackplus/nest-auth-admin"]]
}
```

#### M8 — Rename for consistency

| Old | New |
|---|---|
| `apps/examples-next/` (folder) | `apps/example-next/` |
| `apps/example-nest/` `name: "example-app"` (in package.json) | `name: "example-nest"` |

#### M9 — TypeScript Project References

In each `tsconfig.json`:

```json
{
  "extends": "@ackplus/tsconfig/lib.json",
  "include": ["src"],
  "references": [
    { "path": "../nest-auth-contracts" }
  ],
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  }
}
```

`tsc -b` from any package walks the references and builds in topo order with incremental cache. Combined with Turborepo's task cache, builds become almost free on warm cache.

#### M10 — Fix lint glob

In `apps/example-nest/package.json`:
```diff
- "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
+ "lint": "eslint \"{src,test}/**/*.ts\" --fix"
```

#### M11, M12 — Pin Node

Root `package.json`:
```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

`.nvmrc` at root:
```
20
```

`.npmrc`:
```
engine-strict=true
auto-install-peers=true
```

#### M13 — Standardize build output

Use **`tsup`** for every library package (or **`unbuild`** — pick one). Same config preset in `tools/tsconfig` or as a `tsup.config.ts` template. Output:
- `dist/index.js` (CJS)
- `dist/index.mjs` (ESM)
- `dist/index.d.ts` (types)
- Conditional exports in `package.json`:

```json
{
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### 1.5 Phase 0 work order

Do these BEFORE Phase 1 of the master roadmap. Estimated: **3-5 days for one engineer**.

| Step | Task | Effort |
|---|---|---|
| P0-1 | Add Turborepo + `turbo.json` (M1) | 0.5d |
| P0-2 | Extract `packages/nest-auth/ui/` → `packages/nest-auth-admin/` (M2, M3) | 1d |
| P0-3 | Create `tools/` workspace packages: `tsconfig`, `eslint-config`, `prettier-config` (M6, M9) | 1d |
| P0-4 | Add TypeScript Project References to all packages (M9) | 0.5d |
| P0-5 | Add Changesets (M7) | 0.5d |
| P0-6 | Rename for consistency (M8); fix lint glob (M10) | 0.5d |
| P0-7 | Pin Node engine, add `.nvmrc`, `.npmrc` (M11, M12) | 0.25d |
| P0-8 | Standardize build with tsup (M13) | 0.5d |
| P0-9 | Turn on TS strict mode in base, fix per-package errors (M5) | 1-2d |
| P0-10 | Add new `ci.yml` GH Action: build + test + lint matrix across Node 20/22 | 0.25d |

After Phase 0, **Phase 1 of the master roadmap proceeds with the test harness work**.

---

## Part 2 — Vercel deployment

### 2.1 Short answer

| App | Vercel? | Why |
|---|---|---|
| `apps/docs` (Fumadocs / Next.js) | ✅ **Yes**, perfect fit | Native Next.js, fully static |
| `apps/example-next` (Next.js App Router) | ✅ **Yes**, perfect fit | Native; needs `NEXT_PUBLIC_API_URL` env var pointing to backend |
| `apps/example-react` (Vite SPA) | ✅ **Yes**, deploys as static | Set framework preset to "Vite"; build outputs to `dist/` |
| `apps/example-vanilla` (when built) | ✅ **Yes**, static | Plain HTML |
| `apps/example-nest` (NestJS backend) | ❌ **No** — use Railway/Render instead | See §2.3 |

### 2.2 The reason for the no on NestJS

Vercel is serverless. NestJS-on-Vercel has known footguns for an auth backend:

| Problem | Why it matters for an auth pkg |
|---|---|
| Cold starts on every cold invocation | Login adds 500-1500ms on cold path |
| No persistent DB connections | TypeORM opens a new pool per invocation → Postgres connection limit blown |
| No background tasks | Session cleanup, audit log flushing, webhook delivery need a process |
| 10-60s function timeout | OK for auth but kills batch admin ops (bulk delete 1000 users) |
| No in-memory state | The `RefreshQueue` dedup loses correctness across invocations |
| No WebSocket / SSE | Future real-time admin features blocked |
| Migrations don't run automatically | Manual SQL on every release |

You **can** stuff a NestJS app into a single Vercel function (`api/[[...path]].ts` re-exporting the Express adapter), but every choice above is now a workaround. Don't.

### 2.3 Recommended deployment topology

```
                      ┌──────────────────────────────────┐
                      │           Vercel                 │
                      │                                  │
                      │  apps/docs       → docs.example  │
                      │  example-next    → next.example  │
                      │  example-react   → react.example │
                      │  example-vanilla → vanilla.exam. │
                      └────────────┬─────────────────────┘
                                   │
                                   │  HTTPS  (NEXT_PUBLIC_API_URL,
                                   │          VITE_API_URL)
                                   ▼
                      ┌──────────────────────────────────┐
                      │           Railway                │
                      │   (or Render / Fly.io)           │
                      │                                  │
                      │   nest-auth backend              │
                      │     ↓                            │
                      │   Postgres (managed)             │
                      │   Redis  (managed)               │
                      │                                  │
                      └──────────────────────────────────┘
```

**Why Railway as the backend host:**

| Feature | Railway | Render | Fly.io | Vercel |
|---|---|---|---|---|
| Long-running NestJS process | ✅ | ✅ | ✅ | ❌ |
| Managed Postgres included | ✅ | ✅ | Add-on | ❌ |
| Managed Redis included | ✅ | ✅ | Add-on | ❌ |
| Auto-deploy on git push | ✅ | ✅ | ✅ | ✅ |
| PR preview environments | ✅ | ✅ | Manual | ✅ |
| Free tier viable for demo | $5/mo credit | Free w/ cold start | 3 free VMs | Free hobby |
| WebSockets / SSE | ✅ | ✅ | ✅ | Limited |
| Monorepo aware | ✅ (root dir setting) | ✅ | Via Dockerfile | ✅ |

Pick **Railway** for the demo. **Render** if you prefer free tier with cold-start tolerance. Both are 10-minute deploys.

### 2.4 Concrete deploy steps

#### Backend → Railway

1. Create Railway project; connect this GitHub repo.
2. Add service: **"From repo"**, root directory `apps/example-nest`.
3. Add Postgres plugin (one click).
4. Add Redis plugin (one click).
5. Set env vars:
   ```
   DATABASE_URL=<auto-injected by Postgres plugin>
   REDIS_URL=<auto-injected by Redis plugin>
   JWT_SECRET=<generate strong secret>
   COOKIE_DOMAIN=<your domain>
   ADMIN_SECRET_KEY=<generate strong secret>
   APP_NAME="Nest Auth Demo"
   PUBLIC_URL=https://nest-auth-demo.up.railway.app
   ```
6. Build command: `cd ../.. && pnpm install --frozen-lockfile && pnpm turbo run build --filter=example-nest`
7. Start command: `node dist/main.js`
8. Deploy. URL: `https://nest-auth-demo.up.railway.app`.

#### Docs → Vercel

1. New Vercel project from this repo.
2. Settings:
   - Root directory: `apps/docs`
   - Framework preset: **Next.js**
   - Install command: `cd ../.. && pnpm install --frozen-lockfile`
   - Build command: `cd ../.. && pnpm turbo run build --filter=@ackplus/nest-auth-docs`
   - Output directory: `apps/docs/.next`
3. Deploy. URL: `https://nest-auth-docs.vercel.app`.

#### example-next → Vercel

1. New Vercel project.
2. Settings:
   - Root directory: `apps/example-next`
   - Framework: **Next.js**
   - Install: `cd ../.. && pnpm install --frozen-lockfile`
   - Build: `cd ../.. && pnpm turbo run build --filter=example-next`
3. Env vars:
   ```
   NEXT_PUBLIC_API_URL=https://nest-auth-demo.up.railway.app
   ```
4. Deploy.

#### example-react → Vercel

1. New Vercel project.
2. Settings:
   - Root directory: `apps/example-react`
   - Framework: **Vite**
   - Install: `cd ../.. && pnpm install --frozen-lockfile`
   - Build: `cd ../.. && pnpm turbo run build --filter=example-react`
   - Output: `apps/example-react/dist`
3. Env vars:
   ```
   VITE_API_URL=https://nest-auth-demo.up.railway.app
   ```
4. Deploy.

### 2.5 CORS + cookies in production

For the cross-origin setup above, the backend needs:

```ts
// in main.ts of example-nest
app.enableCors({
  origin: [
    'https://nest-auth-docs.vercel.app',
    'https://nest-auth-example-next.vercel.app',
    'https://nest-auth-example-react.vercel.app',
  ],
  credentials: true, // required for httpOnly-cookie mode
});

// in NestAuthModule config
session: {
  cookie: {
    sameSite: 'none', // required for cross-site cookies
    secure: true,     // required when sameSite=none
    domain: undefined, // do NOT set when cross-origin; let browser default
  },
},
```

Document this in `apps/docs/content/docs/production/cors-and-cookies.mdx`.

### 2.6 Preview environments

Vercel gives you automatic preview deploys per PR for free. To wire preview-frontend → preview-backend:

1. Railway also gives PR previews (paid feature, $5/mo plan).
2. Set Vercel env var per-environment:
   - Production: `NEXT_PUBLIC_API_URL=https://nest-auth-demo.up.railway.app`
   - Preview: `NEXT_PUBLIC_API_URL=https://nest-auth-pr-${VERCEL_GIT_COMMIT_REF}.up.railway.app`

This requires a small GH Action to plug Railway preview URL into Vercel preview env. Skip unless you ship demos often.

### 2.7 Alternative — single-host with Coolify or Caprover

If you want to self-host EVERYTHING on one $5 VPS (Hetzner CX22, DigitalOcean droplet, etc.):

- Install **Coolify** (https://coolify.io) — open-source PaaS, Docker-compose-aware, supports monorepos and Postgres add-ons.
- Each app gets its own subdomain.
- Pull-based deploys via GitHub webhook.
- ~$5/mo total for all four examples + Postgres + Redis.

Best fit if you want full control and lowest cost. Worse fit if you want zero-config preview environments.

### 2.8 Decision matrix

| Goal | Choose |
|---|---|
| Fastest demo, lowest config | **Railway (backend) + Vercel (frontends)** |
| Lowest cost, willing to self-host | Coolify on a $5 VPS |
| Already on AWS | ECS Fargate + ALB + RDS + ElastiCache |
| Already on GCP | Cloud Run + Cloud SQL + Memorystore |
| Free tier mandatory | Render (free w/ cold start) + Vercel hobby |

My recommendation: **Railway + Vercel.** It's the path of least resistance for a demo, you can ship it in an afternoon, and your docs/marketing site (`apps/docs`) is on Vercel anyway.

---

## 3 — Decisions you need to make

| # | Decision | Recommendation |
|---|---|---|
| MD1 | Adopt Turborepo? | **Yes** — biggest single dev-experience win |
| MD2 | Extract embedded UI to `packages/nest-auth-admin`? | **Yes** — already in master roadmap §5.1; do it in Phase 0 |
| MD3 | Adopt Changesets? | **Yes** — replaces manual tag flow |
| MD4 | Turn on TS strict mode? | **Yes** — but stage over 1-2 weeks, package by package |
| MD5 | Backend deploy target? | **Railway** for demos; production users self-host |
| MD6 | Frontend deploy target? | **Vercel** for the 3 frontends |
| MD7 | PR preview environments? | **Yes** for Vercel (free); **skip** for Railway initially |
| MD8 | Renames (`examples-next` → `example-next`, etc.) — do them now or defer? | **Now**, in Phase 0; they're free and reduce confusion |

---

## Verification

This work is done when:
- `pnpm install` at root works without any `--prefix npm` invocations.
- `pnpm turbo run build` builds all packages with caching.
- `pnpm changeset` workflow is wired and at least one release ships through it.
- TypeScript strict mode is on in `tools/tsconfig/base.json` and every package compiles cleanly.
- `apps/docs`, `apps/example-next`, `apps/example-react` each deploy to Vercel from a single git push.
- `apps/example-nest` deploys to Railway from a single git push, with Postgres + Redis attached.
- A CI matrix runs build + test + lint on Node 20 and 22 on every PR.

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) — overall plan; this doc is Phase 0
- [`test-catalog.md`](test-catalog.md) — `tools/vitest-preset` houses the real-test helpers
- [`013-no-test-coverage-on-any-package.md`](013-no-test-coverage-on-any-package.md) — testing setup that lives in `tools/vitest-preset`
- [`005-build-openapi-script-is-stub.md`](005-build-openapi-script-is-stub.md) — OpenAPI gen feeds the deployed Scalar viewer
