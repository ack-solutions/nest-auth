# `tools/` — internal shared configs

Four internal workspace packages that every other package in this monorepo consumes for dev config. **Never published to npm** (all `private: true`, version `0.0.0`).

| Package | Imported by | What it provides |
|---|---|---|
| `@ackplus/tsconfig` | every `packages/*` and `apps/*` | TypeScript preset JSONs (`base`, `lib`, `app`, `vite`, `strict`) |
| `@ackplus/eslint-config` | every `packages/*` and `apps/*` | ESLint flat-config flavors (`default`, `react`, `node`) |
| `@ackplus/prettier-config` | every `packages/*` and `apps/*` | One Prettier config |
| `@ackplus/vitest-preset` | every package that has tests | Vitest preset + real-test helpers (populated in Phase 1) |

## Consuming

**tsconfig:**
```jsonc
// packages/foo/tsconfig.json
{
  "extends": "@ackplus/tsconfig/lib.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"]
}
```

**eslint:**
```js
// packages/foo/eslint.config.js
import base from '@ackplus/eslint-config';        // or '@ackplus/eslint-config/react' / '/node'
export default base;
```

**prettier:**
```jsonc
// packages/foo/package.json
{ "prettier": "@ackplus/prettier-config" }
```

**vitest:**
```ts
// packages/foo/vitest.config.ts
import { defineConfig } from 'vitest/config';
import preset from '@ackplus/vitest-preset';
export default defineConfig(preset());
```

## When updating

- Changes here ripple to every consumer. Run `pnpm turbo run build typecheck lint test` after a change.
- Migration of consumers onto these presets is staged: T-004 migrates tsconfigs, T-009 turns on strict mode, Phase 1 tasks add the vitest helpers, etc.
- Do NOT add runtime dependencies here — these are dev/config packages only.
