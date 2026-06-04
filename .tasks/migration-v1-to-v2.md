---
id: migration-v1-to-v2
priority: P0
area: docs
status: draft
package: monorepo
title: Migration guide — `@ackplus/nest-auth` v1.x → v2.0
---

## Summary

`@ackplus/nest-auth` v2.0 is a **major version bump** with breaking changes across all four packages. This document is the canonical migration guide consumers will follow to upgrade. It's drafted now (during refactor) and finalized at v2.0 GA.

**Audience:** existing v1.x consumers. **Goal:** upgrade in 1-2 hours for a typical app, longer if heavy custom integrations.

> **Status:** This is a **draft** maintained alongside the refactor. Each phase of the [`master-roadmap`](000-master-roadmap.md) adds concrete migration entries as the breaking change lands. Don't expect the steps to be runnable until v2.0 beta.

---

## What changed at a glance

| Area | v1.x | v2.0 | Why |
|---|---|---|---|
| Config | One giant `IAuthModuleOptions` flat object | `plugins: [...]` array of `NestAuthPlugin` instances + small core config | Customization & extensibility ([`master-roadmap`](000-master-roadmap.md) §3) |
| Hooks | Loose-typed config callbacks | Typed `UserHooks`/`RoleHooks`/`TenantHooks` interfaces; receives `ctx.tx` for transactional rollback | Cross-system sync correctness ([`cross-system-sync.md`](cross-system-sync.md)) |
| Events | `EventEmitter2` with `any` payloads | Strict `AuthEventMap`, `@OnAuthEvent('user.created')` decorator | Type safety |
| Tenant modes | `ISOLATED` was a no-op | `ISOLATED` enforces row-level isolation; `tenantId` on sessions/identities/mfa_secrets | [`019`](019-isolated-mode-not-actually-isolated.md), [`022`](022-sessions-tenantid-not-a-column.md), [`024`](024-mfa-not-tenant-scoped-design-undocumented.md) |
| Client SDK | `onTokensSet`/`onTokensRemoved` patch points | `authClient.attachToAxios(instance)` + `authClient.attachToFetch(wrapper)` | [`client-sdk-token-handling.md`](client-sdk-token-handling.md) |
| React hooks | `useAccessToken()` re-renders on every change | `useAuthHeaderFn()` returns stable function ref | Same |
| Admin UI | Embedded inside `@ackplus/nest-auth` package, mixed npm+pnpm+yarn lockfiles | Separate `@ackplus/nest-auth-admin` workspace package | [`monorepo-and-deployment.md`](monorepo-and-deployment.md) M2 |
| Schema | `sessions.tenantId` in JSON, no compound unique on identities, no per-tenant MFA | Real columns + indexes; per-tenant where mode requires | DB integrity |
| OpenAPI | Hand-maintained `nest-auth.json` | Generated from live backend; embedded via Scalar in docs | T-024 |
| Build | Mixed `tsc` + `tsup` + raw shell scripts | Turborepo orchestrates; tsup-standard library output | [`monorepo-and-deployment.md`](monorepo-and-deployment.md) |
| Tests | None | Real-DB Testcontainers, no mocks | [`test-catalog.md`](test-catalog.md) |
| API keys | `privateKey` stored in **plaintext**, compared with `===` | `privateKey` stored as domain-separated SHA-256 hash, verified with `timingSafeEqual`; **existing keys must be regenerated** | B-12 security fix |

---

## ⚠️ Breaking: regenerate all API keys

v2 stores API-key secrets hashed at rest (B-12). Legacy keys created under v1.x were stored in plaintext and will **fail validation** after upgrade (gracefully — `validateAccessKey` returns `false`, no crash). Before/after cutover:

1. Notify API-key holders that keys must be rotated.
2. Have each user/service create a new key via `AccessKeyService.createAccessKey(...)` (or the admin UI) and capture the plaintext **once** — it is no longer recoverable from the DB.
3. Deactivate/delete the old keys.

There is no automatic re-hash migration because the original plaintext is the only thing that could be re-hashed, and storing it was the vulnerability. Rotation is the correct path.

---

## Pre-upgrade checklist

Before you start:

1. **Pin v1.x** in your `package.json` so you can roll back: `"@ackplus/nest-auth": "1.x"`.
2. **Take a DB snapshot.** v2 includes schema changes (additive in most cases, but `sessions.tenantId` migration moves data).
3. **Audit your repo for direct repository mutations**: `grep -rn "userRepo\\.save\\|userRepo\\.insert\\|userRepo\\.update\\|userRepo\\.delete"`. v2's lint rule (T-053b) will fail builds that mutate `Repository<NestAuth*>` outside the application layer.
4. **List your current hooks + custom auth providers + admin overrides.** You'll re-express these as plugins or as the new typed hooks.
5. **Identify your tenant mode.** If you're on ISOLATED, expect schema work (it was a no-op in v1; v2 enforces real isolation).

---

## Upgrade in 12 steps

Each step links to its detail section below.

1. [Bump versions](#step-1--bump-versions)
2. [Run schema migrations](#step-2--run-schema-migrations)
3. [Migrate config from `IAuthModuleOptions` to `plugins: [...]`](#step-3--migrate-config-to-plugins-array)
4. [Convert hooks to the typed `UserHooks`/`RoleHooks`/`TenantHooks` shape](#step-4--convert-hooks)
5. [Convert event listeners to `@OnAuthEvent`](#step-5--convert-event-listeners)
6. [Replace token-handling patches with `attachToAxios`/`attachToFetch`](#step-6--replace-client-token-patches)
7. [Replace `useAccessToken` with `useAuthHeaderFn` where it caused re-renders](#step-7--swap-useaccesstoken-for-useauthheaderfn)
8. [Validate tenant mode behavior](#step-8--validate-tenant-mode-behavior)
9. [Install `@ackplus/nest-auth-admin` if you used the embedded admin UI](#step-9--admin-ui-package-rename)
10. [Update OpenAPI consumers](#step-10--openapi-consumers)
11. [Verify the request-mutation lint rule passes](#step-11--lint-rule-verification)
12. [Run the v2 compatibility test suite](#step-12--run-compat-tests)

---

## Step 1 — Bump versions

All four packages release together at the same version.

```bash
pnpm add @ackplus/nest-auth@2 \
         @ackplus/nest-auth-client@2 \
         @ackplus/nest-auth-react@2 \
         @ackplus/nest-auth-contracts@2

# New optional admin UI package (separate install)
pnpm add @ackplus/nest-auth-admin@2
```

Engines: requires Node ≥ 20, pnpm ≥ 10.

---

## Step 2 — Run schema migrations

v2 ships schema migrations that:

- Add `tenantId` column to `nest_auth_sessions` (migrates data from JSON `data.tenantId` first)
- Add `tenantId` column to `nest_auth_identities` (nullable in shared mode, required in isolated)
- Add `tenantId` column to `nest_auth_mfa_secrets` (same)
- Add `tenantId` column to `nest_auth_trusted_devices` (same)
- Add compound unique `(provider, providerId)` on `nest_auth_identities`
- Add unique constraint on `(email, tenantId)` in isolated mode
- Replaces single-string `mfaRecoveryCode` column with proper `nest_auth_mfa_recovery_codes` table (migrate existing codes first)
- Adds `nest_auth_outbox` table (T-054d)

```bash
# CLI tool runs migrations in order, idempotent, rollback-able
npx @ackplus/nest-auth-migrate up
```

**The CLI also offers `--check` for a dry-run.** Inspect the SQL before applying. See **Schema migration details** below for the SQL plan per migration.

---

## Step 3 — Migrate config to plugins array

### Before (v1.x)

```ts
NestAuthModule.forRoot({
  appName: 'My App',
  session: { jwt: { secret: env.JWT_SECRET } },
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
  mfa: { enabled: true, methods: ['totp', 'email-otp'] },
  passwordless: { enabled: true, allowSignUp: true },
  tenant: { enabled: true, mode: 'SHARED' },
  adminConsole: { enabled: true, secretKey: env.ADMIN_SECRET },
  hooks: {
    user: {
      afterCreate: async (user) => { /* ... */ },
    },
  },
});
```

### After (v2)

```ts
import {
  NestAuthModule,
  emailPasswordPlugin, oauthGooglePlugin, oauthGithubPlugin,
  mfaTotpPlugin, mfaEmailOtpPlugin,
  passwordlessEmailPlugin,
  organizationsPlugin,
  adminConsolePlugin,
} from '@ackplus/nest-auth';

NestAuthModule.forRoot({
  appName: 'My App',
  jwt: { secret: env.JWT_SECRET },          // core: required, no longer under session.*
  plugins: [
    emailPasswordPlugin(),
    oauthGooglePlugin({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
    oauthGithubPlugin({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }),
    mfaTotpPlugin(),
    mfaEmailOtpPlugin(),
    passwordlessEmailPlugin({ allowSignUp: true }),
    organizationsPlugin({ mode: 'shared' }),
    adminConsolePlugin({ secretKey: env.ADMIN_SECRET }),
  ],
  hooks: {
    user: {
      afterCreate: async (user, input, ctx) => { /* ... */ },   // signature has changed — see step 4
    },
  },
});
```

### Adapter mode (v2.0 only)

For one minor version, v2.0 ships a **compatibility adapter** that accepts the old flat config and converts it to plugins internally with a deprecation warning. So you can ship a code change in two phases:

```ts
NestAuthModule.forRootLegacy({       // ← deprecated alias, removed in v3
  google: { /* ... */ },
  github: { /* ... */ },
  // ... old shape
});
```

**Recommended:** migrate fully to the plugin syntax during your v2 upgrade. Adapter exists for unblocking, not for staying.

---

## Step 4 — Convert hooks

The hook signature changes to give you a transactional context. **This unlocks the rollback semantics** described in [`cross-system-sync.md`](cross-system-sync.md).

### Before (v1.x)

```ts
hooks: {
  user: {
    afterCreate: async (user) => {
      // Ran AFTER commit. If this threw, the user already existed.
      await this.appUserService.create({ authUserId: user.id });
    },
  },
},
```

### After (v2)

```ts
hooks: {
  user: {
    afterCreate: async (user, input, ctx) => {
      // Runs INSIDE the same DB transaction. Throw → full rollback.
      await ctx.tx.getRepository(AppUser).insert({
        authUserId: user.id,
        source: ctx.source,        // 'api.signup' | 'admin.dashboard' | ...
        createdBy: ctx.actorId,    // admin id or null
      });
    },
  },
},
```

Signature changes:
- New 3rd parameter: `ctx: UserHookContext` with `tx`, `source`, `actorId`, `tenantId`, `logger`.
- New 2nd parameter for `afterCreate`: the original `input` (the request DTO).
- For `afterUpdate`: receives `(user, prev, ctx)` so you can diff fields.
- For `afterDelete`: receives `(userId, snapshot, ctx)` — snapshot is the row before deletion.

Same shape for `RoleHooks`, `TenantHooks`, `SessionHooks`. See [`cross-system-sync.md`](cross-system-sync.md) §"Pattern 1 — Hook".

### For multi-system rollback (Stripe, CRM, etc.)

Use the new `Saga` primitive:

```ts
import { Saga } from '@ackplus/nest-auth';

hooks: {
  user: {
    afterCreate: async (user, input, ctx) => {
      const saga = new Saga(ctx);
      saga.step({
        name: 'stripe-customer',
        do:         async () => { customerId = (await stripe.customers.create(...)).id; },
        compensate: async () => { if (customerId) await stripe.customers.del(customerId); },
      });
      // ... more steps
      await saga.run();
    },
  },
},
```

See [`cross-system-sync.md`](cross-system-sync.md) §"Rule 2 — saga" for full pattern.

### For post-commit rollback — the `ReversalService`

Sometimes you discover the auth action shouldn't have happened **after** the transaction already committed (e.g., async payment verification runs 30s after signup and detects fraud). In v1.x you had to write your own delete-cascade carefully. In v2:

```ts
import { ReversalService } from '@ackplus/nest-auth';

@OnEvent('payment.fraud-detected')
async onFraud(event: { userId: string }) {
  await this.reversalService.deleteUser(event.userId, {
    source: 'plugin.fraud-detector',
    reason: 'payment-fraud',
    actorId: null,
  });
  // Runs the full lifecycle:
  //   - opens a fresh tx
  //   - fires user.beforeDelete hooks (your AppUser/BillingAccount cascade)
  //   - deletes nest_auth_user (cascades sessions, identities, mfa)
  //   - emits user.deleted event with source='plugin.fraud-detector'
  //   - outbox dispatches downstream
}
```

Also provides `deleteRole(roleId, ctx)`, `deleteTenant(tenantId, ctx)`, `revokeSession(sessionId, ctx)`. See [`cross-system-sync.md`](cross-system-sync.md) §"Rule 4 — the reverse direction" for full semantics.

---

## Step 5 — Convert event listeners

### Before (v1.x)

```ts
@OnEvent('user.created')
async onUserCreated(payload: any) {
  // any-typed; easy to drift
  await this.mailer.send(payload.user.email, 'welcome');
}
```

### After (v2)

```ts
import { OnAuthEvent, AuthEventMap } from '@ackplus/nest-auth';

@OnAuthEvent('user.created')
async onUserCreated(payload: AuthEventMap['user.created']) {
  // Fully typed payload, including source discriminator
  await this.mailer.send(payload.user.email, 'welcome');
  if (payload.source === 'admin.dashboard') {
    // Optionally branch on source
  }
}
```

The full `AuthEventMap` is exported from `@ackplus/nest-auth-contracts`. See it for the complete list of typed events (30+).

**Important:** v2 enforces that **every mutation path emits the canonical event**, including admin dashboard actions. If your v1 listeners only fired for API signups but not admin-created users, this changes — listeners will now run for both. Audit your listener logic for source-dependent branching if needed.

---

## Step 6 — Replace client token patches

If your v1 React app has any of these patterns:

```tsx
// V1 (the patch)
<AuthProvider onTokensSet={({ accessToken }) => {
  axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
}}>
```

Replace with:

```tsx
// V2
useEffect(() => authClient.attachToAxios(myAxios, { retryOn401: true }), [authClient]);
```

The `attachToAxios` helper handles login + refresh + logout + cookie-mode + 401 retry in one. See [`client-sdk-token-handling.md`](client-sdk-token-handling.md) for the full design.

`onTokensSet`/`onTokensRemoved` props remain available in v2.0 (with a deprecation warning) and are removed in v3.

---

## Step 7 — Swap useAccessToken for useAuthHeaderFn

`useAccessToken()` re-renders consumers on every token change. For request-decoration use cases, `useAuthHeaderFn()` returns a stable function ref that reads the current token on demand.

### Before (v1.x)

```tsx
function MyForm() {
  const accessToken = useAccessToken();           // re-renders this whole tree on refresh

  const submit = async () => {
    await fetch('/api', { headers: { Authorization: `Bearer ${accessToken}` } });
  };
}
```

### After (v2)

```tsx
function MyForm() {
  const getAuthHeader = useAuthHeaderFn();        // stable ref; no re-render on refresh

  const submit = async () => {
    const headers = await getAuthHeader();
    await fetch('/api', { headers });
  };
}
```

`useAccessToken()` remains for cases where you genuinely need the token value reactively (rare). It's not deprecated.

---

## Step 8 — Validate tenant mode behavior

**If you used SHARED mode in v1.x:** no behavior change — but you'll benefit from the new `sessions.tenantId` column and the canonical-event fix. No code changes required.

**If you used DISABLED mode in v1.x:** v2 now **rejects** `tenantId` in body/query/header on every endpoint (v1 silently discarded it). If you were inadvertently sending it, you'll get 400s. Audit your client code.

**If you used ISOLATED mode in v1.x:** in v1, ISOLATED was a no-op — same as SHARED. In v2, ISOLATED **actually isolates**: queries without `tenantId` filter throw at runtime. This is a behavior change.

- Audit any custom queries you wrote against the auth tables (rare).
- Audit any custom hooks that read other-tenant data (now blocked).
- If you can't migrate to true isolation yet, switch to SHARED mode for now: `organizationsPlugin({ mode: 'shared' })`.

---

## Step 9 — Admin UI package rename

v1 shipped the admin UI inside `@ackplus/nest-auth`. v2 splits it into `@ackplus/nest-auth-admin`. If you used the admin console:

```bash
pnpm add @ackplus/nest-auth-admin
```

```ts
// V1: implicit (came with nest-auth)
NestAuthModule.forRoot({ adminConsole: { enabled: true, secretKey: ... } });

// V2: explicit plugin
import { adminConsolePlugin } from '@ackplus/nest-auth-admin';
NestAuthModule.forRoot({
  plugins: [adminConsolePlugin({ secretKey: env.ADMIN_SECRET })],
});
```

The new package also lets you:
- Register custom admin pages via `registerAdminPage({ ... })`
- Theme via CSS variables
- Disable the embedded UI entirely (just keep the API) if you want to build your own

If you didn't use the embedded admin UI in v1, ignore this step — `@ackplus/nest-auth-admin` is optional.

---

## Step 10 — OpenAPI consumers

If you generated client SDKs from `apps/docs/public/api/nest-auth.json`:

- In v1, the JSON was hand-maintained and could drift.
- In v2, the JSON is **generated from the live backend** at every release (T-024) and embedded via Scalar in the docs site at `/docs/api-reference/`.
- Schema differences vs. v1 spec: some operations have new `tags`, new error responses, new examples. Re-regenerate your client SDK.

If you embedded Swagger UI or Redoc in your own app pointing at our spec URL: consider switching to `@scalar/api-reference-react` for a better experience (or keep your tool — the spec is standard OpenAPI 3.0).

---

## Step 11 — Lint rule verification

v2 ships a lint rule that fails the build if any code outside the `application/` layer (your custom NestJS controllers, plugins, services) directly mutates a `Repository<NestAuth*>`:

```ts
// ❌ This now fails:
const user = await this.userRepo.save({ email: '...' });

// ✅ Use the canonical service:
const user = await this.signupService.create({ email: '...' }, { source: 'plugin.custom' });
```

The reason is the canonical-event invariant — `user.created` MUST fire whenever a user is created. Direct repo writes bypass the event.

If you have legitimate uses (read-only access patterns are fine; you can also opt-out per file with a comment), see [`cross-system-sync.md`](cross-system-sync.md) §"Admin dashboard sync — the trap" for the rule's rationale.

---

## Step 12 — Run compat tests

We ship a v2 compatibility test pack that runs against your app:

```bash
npx @ackplus/nest-auth-compat-check
```

It exercises:
- All v1 endpoint paths still work
- All v1 events still fire (with new typed payloads)
- All v1 hooks still run (under the adapter layer)
- Schema migration completed cleanly
- No remaining `forwardRef` cycles in your wiring

A passing run is your green light to ship v2 to staging.

---

## Schema migration details

The migrator runs these in order. Each is reversible until the next runs.

| # | Migration | Effect | Rollback |
|---|---|---|---|
| 2001 | Add `tenantId` column to `nest_auth_sessions`; backfill from JSON `data.tenantId`; drop key from JSON | Real column with index | Backfill back into JSON |
| 2002 | Add `tenantId` column to `nest_auth_identities` | Nullable in SHARED/DISABLED; backfilled from `userAccesses` join | Drop column |
| 2003 | Add `tenantId` column to `nest_auth_mfa_secrets` | Same nullability | Drop column |
| 2004 | Add `tenantId` column to `nest_auth_trusted_devices` | Same | Drop column |
| 2005 | Add compound unique `(provider, providerId)` on `nest_auth_identities` | Race-safe OAuth linking | Drop index |
| 2006 | Create `nest_auth_mfa_recovery_codes` table; migrate single-string codes per user into rows | Proper recovery code model | Coalesce back to single string (data loss on regenerate-since-migration) |
| 2007 | Create `nest_auth_outbox` table | For T-054d outbox plugin | Drop table |
| 2008 | If ISOLATED mode: add unique `(email, tenantId)` to `nest_auth_users` and `(phone, tenantId)` | True per-tenant uniqueness | Drop indexes |

**Run order matters.** The migrator enforces it. Do not edit migrations by hand.

---

## Rollback plan

If v2 doesn't work for you, downgrade is supported within 30 days of upgrade:

```bash
# 1. Pin back to v1.x
pnpm add @ackplus/nest-auth@^1.x \
         @ackplus/nest-auth-client@^1.x \
         @ackplus/nest-auth-react@^1.x \
         @ackplus/nest-auth-contracts@^1.x

# 2. Run reverse migrations (in reverse order)
npx @ackplus/nest-auth-migrate down --to 2000

# 3. Restore your DB snapshot if you took one (recommended)
```

Caveats:
- The outbox table is dropped — any pending deliveries are lost.
- The new recovery codes table is dropped — any codes regenerated under v2 are lost (codes from before v1 still work because they're coalesced back).
- New `tenantId` data in JSON columns is preserved by the downgrade.

We do NOT support partial rollback (some packages on v2, some on v1). Version-lock keeps them in step.

---

## Known issues + workarounds

This section is populated as v2.0 beta progresses. Currently empty (draft phase).

---

## Getting help

- File an issue: https://github.com/ack-solutions/nest-auth/issues — use the `migration:v1-to-v2` label
- Discussion thread for migration questions: TBD
- Direct support (paid tier): contact@ackplus.com

---

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) — full v2.0 scope
- [`task-tracker.md`](task-tracker.md) — execution status; this guide is finalized when Phase 9 completes
- [`cross-system-sync.md`](cross-system-sync.md) — hook + saga + outbox patterns
- [`client-sdk-token-handling.md`](client-sdk-token-handling.md) — token-in-request architecture
- [`monorepo-and-deployment.md`](monorepo-and-deployment.md) — workspace + deployment changes
