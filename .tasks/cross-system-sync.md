---
id: cross-system-sync
priority: P0
area: architecture
status: design
package: '@ackplus/nest-auth'
title: Cross-system data sync — design (keep consumer tables in lockstep with nest-auth)
---

## Summary

A consumer app that uses `nest-auth` will almost always have its own related tables — `AppUser`, `Organization`, `BillingAccount`, `ProjectMembership`, etc. — that must stay in sync with nest-auth's entities. **The same sync must happen regardless of where the change originates**: API signup, OAuth callback, magic link, admin dashboard, programmatic admin SDK, scheduled job, anything.

This doc defines four sync patterns, when to use each, the guarantees they offer, and the **invariant we enforce in the codebase**: every mutation path emits the same typed event with the same payload shape.

This design lands as part of Phase 2 ([`T-053`](task-tracker.md#phase-2--architecture-refactor-32-tasks) event bus + [`T-054`](task-tracker.md#phase-2--architecture-refactor-32-tasks) hook registry) and is exercised by Phase 1 tests.

---

## The hard requirement

> **Single mutation path per entity per action.** Whether a user is created via `POST /auth/signup`, OAuth callback, magic-link, admin dashboard, or a custom plugin, exactly **one** call site runs: `SignupService.create(...)` (or equivalent use-case service). That call site emits the canonical event and runs the canonical hook chain. The HTTP / dashboard / OAuth / plugin code is a thin entry point that **must not** do its own `userRepo.save()`.

If we don't enforce this, "user.created" only fires on some paths and consumer apps drift out of sync silently. Today's code has at least three places that call `userRepo.save()` directly — that's a refactor target.

**Verification:** [`T-053`](task-tracker.md) acceptance includes a static check (AST scan + lint rule) that fails CI if any code outside the `application/` layer mutates a domain entity.

---

## The four sync patterns

| # | Pattern | Sync vs. async | Blocks the auth flow? | Transactional? | Best for |
|---|---|---|---|---|---|
| 1 | **Hook (use-case extension)** | sync | yes — can abort flow | yes — same DB tx as the auth write | Consumer-owned related rows ("I have an `AppUser` with extra columns") |
| 2 | **Event (typed bus)** | async | no | no — runs after commit | Side effects ("send welcome email", "audit log", "fire webhook") |
| 3 | **Plugin** | both | yes (hooks part) / no (events part) | yes (hooks part) | A reusable feature module that needs both behaviors |
| 4 | **Outbox** | async, durable | no | yes (event row written in tx) | At-least-once delivery to external systems (Kafka, Stripe, email) |

The same patterns apply to **every entity**: `User`, `Identity`, `Role`, `Permission`, `Tenant`, `UserAccess`, `Session`, `MfaSecret`, `ApiKey`, `AuditLog`.

---

## Pattern 1 — Hook (sync, transactional)

**When:** you have a related table that MUST exist whenever the auth row exists. Example: every `NestAuthUser` must have a matching `AppUser` row with `companyId` and `onboardingState`.

**Signature** (new, typed — replaces today's loose hook config):

```ts
// From @ackplus/nest-auth-contracts
export interface UserHookContext {
  /** Active TypeORM EntityManager bound to the same transaction as the auth write. */
  readonly tx: EntityManager;
  /** Where this mutation came from. */
  readonly source:
    | 'api.signup'
    | 'api.oauth-callback'
    | 'api.magic-link'
    | 'api.passwordless'
    | 'admin.dashboard'
    | 'admin.sdk'
    | 'plugin.<id>';
  /** The actor performing the action (admin user id, or null for self-signup). */
  readonly actorId: string | null;
  /** Current tenant context (null in DISABLED mode). */
  readonly tenantId: string | null;
  /** Plugin-scoped logger. */
  readonly logger: Logger;
}

export interface UserHooks {
  beforeCreate?(input: CreateUserInput, ctx: UserHookContext): Promise<CreateUserInput | void>;
  afterCreate?(user: NestAuthUser, input: CreateUserInput, ctx: UserHookContext): Promise<void>;
  beforeUpdate?(user: NestAuthUser, patch: UpdateUserInput, ctx: UserHookContext): Promise<UpdateUserInput | void>;
  afterUpdate?(user: NestAuthUser, prev: NestAuthUser, ctx: UserHookContext): Promise<void>;
  beforeDelete?(user: NestAuthUser, ctx: UserHookContext): Promise<void>;
  afterDelete?(userId: string, snapshot: NestAuthUser, ctx: UserHookContext): Promise<void>;
}
```

**Consumer code:**

```ts
NestAuthModule.forRoot({
  jwt: { secret: env.JWT_SECRET },
  hooks: {
    user: {
      afterCreate: async (user, input, ctx) => {
        // Runs INSIDE the same DB transaction as the user insert.
        // If this throws → the user insert rolls back.
        await ctx.tx.getRepository(AppUser).insert({
          authUserId: user.id,
          companyId: input.metadata?.companyId ?? null,
          onboardingState: 'pending',
          createdBy: ctx.actorId,        // null on self-signup, admin id otherwise
          source: ctx.source,            // 'admin.dashboard' or 'api.signup', etc.
        });
      },
      afterDelete: async (userId, snapshot, ctx) => {
        await ctx.tx.getRepository(AppUser).softDelete({ authUserId: userId });
      },
    },
    role:   { afterCreate: async (role, input, ctx) => { /* ... */ } },
    tenant: { afterCreate: async (tenant, input, ctx) => { /* ... */ } },
  },
});
```

**Guarantees:**
- **Transactional.** If `afterCreate` throws, the `NestAuthUser` insert is also rolled back. Data integrity by construction.
- **Same-process.** No queue, no retries needed.
- **Ordered.** Hooks run in declaration order; one mutation completes fully before the response returns.

**Drawbacks:**
- Hook code runs in the auth process. Slow hook → slow signup. (Recommendation: keep hooks ≤100ms.)
- Single subscriber per phase per entity. Want fan-out? Use events.

---

## Pattern 2 — Event (async, post-commit, multi-subscriber)

**When:** the side effect doesn't need to block the auth response. Sending a welcome email. Pushing to a webhook. Updating an analytics counter. Cascading to a non-critical CRM.

**Signature** (typed event map — fixes the current loose `EventEmitter2` usage):

```ts
// From @ackplus/nest-auth-contracts
export interface AuthEventMap {
  'user.created':  { user: NestAuthUser; source: HookSource; actorId: string | null; tenantId: string | null; at: Date };
  'user.updated':  { user: NestAuthUser; prev: NestAuthUser; changedFields: (keyof NestAuthUser)[]; source: HookSource; actorId: string | null; at: Date };
  'user.deleted':  { userId: string; snapshot: NestAuthUser; source: HookSource; actorId: string | null; at: Date };
  'user.email-changed': { userId: string; oldEmail: string | null; newEmail: string; verified: boolean; at: Date };
  'user.mfa-enabled':   { userId: string; method: MFAMethod; at: Date };
  'user.mfa-disabled':  { userId: string; at: Date };
  // ... same shape for role, permission, tenant, user-access, session, identity, api-key
  'role.created':   { role: NestAuthRole; source: HookSource; actorId: string | null; tenantId: string | null; at: Date };
  'tenant.created': { tenant: NestAuthTenant; source: HookSource; actorId: string | null; at: Date };
  'session.revoked':{ sessionId: string; userId: string; reason: SessionRevokedReason; source: HookSource; at: Date };
  // ...
}
```

**Consumer code:**

```ts
@Injectable()
export class CrmSyncListener {
  constructor(private readonly crm: CrmClient) {}

  @OnAuthEvent('user.created')
  async onUserCreated(event: AuthEventMap['user.created']) {
    if (event.source === 'api.signup') {
      await this.crm.createLead({ email: event.user.email, source: 'self-signup' });
    }
  }

  @OnAuthEvent('user.deleted')
  async onUserDeleted(event: AuthEventMap['user.deleted']) {
    await this.crm.markLeadDeleted(event.userId);
  }
}
```

**Guarantees:**
- **Fires after commit.** The auth response has already been sent; the listener can't affect it.
- **Multiple subscribers.** Email, audit, CRM, webhooks — all can subscribe to `user.created`.
- **Errors don't break auth flow.** A failing listener doesn't roll back the user. (Listener errors are logged; for at-least-once delivery, use Pattern 4.)

**Drawbacks:**
- Eventually consistent. If the process crashes between commit and listener execution, the listener never runs. Don't use this when the related row MUST exist for the system to function.

---

## Pattern 3 — Plugin

**When:** you want to bundle hooks + events + entities + admin UI + migrations into a reusable unit. Either for your own monorepo (one app depends on it) or to publish to npm.

```ts
class AppUserPlugin extends NestAuthPlugin {
  id = 'app-user';
  version = '1.0.0';
  coreVersion = '^2.0.0';

  entities() {
    return [AppUser, AppUserAuditLog];
  }

  // Hook-style: runs in tx, transactional
  hooks() {
    return {
      user: {
        afterCreate: async (user, input, ctx) => {
          await ctx.tx.getRepository(AppUser).insert({ authUserId: user.id, /* ... */ });
        },
        afterDelete: async (userId, snapshot, ctx) => {
          await ctx.tx.getRepository(AppUser).softDelete({ authUserId: userId });
        },
      },
    };
  }

  // Event-style: post-commit, non-blocking
  events() {
    return [
      { event: 'user.created', handler: async (e) => { /* push to analytics */ } },
    ];
  }

  // Plugin owns its own admin UI tab inside the user-detail page
  adminUI() {
    return [{
      slot: 'user-detail-tab',
      title: 'App profile',
      bundleUrl: '/auth/plugin/app-user/bundle.js',
    }];
  }

  migrations() {
    return [require('./migrations/0001-app-user.ts').default];
  }
}
```

**Guarantees:** Combination of #1 + #2 with the encapsulation of a plugin (own entities, own migrations, own admin UI).

**Drawbacks:** More boilerplate. Worth it when the consumer code grows past ~200 LOC of hook handlers, or when you want to ship the integration.

---

## Pattern 4 — Outbox (durable, at-least-once)

**When:** a downstream system MUST receive the event eventually (Stripe subscription cancel, Kafka topic, third-party webhook). You can't lose deliveries if the process crashes.

**Mechanism:**
1. In the SAME DB transaction as the user write, insert a row into `nest_auth_outbox`:
   ```
   (id, eventName, payload, createdAt, deliveredAt nullable)
   ```
2. A background worker (separate process, or in-process `OnApplicationBootstrap` poller) reads `outbox WHERE deliveredAt IS NULL`, calls subscribers, marks delivered.
3. Workers are idempotent (re-delivery on crash is OK).

We provide this as a built-in plugin: `outboxPlugin({ poller: 'in-process' | 'external' })`.

**Guarantees:** At-least-once delivery. Survives process crashes. Each delivery is durably recorded.

**Drawbacks:** Adds a table + a worker. Latency = poll interval (typically 1-5s). Consumers must handle duplicate deliveries (use the outbox `id` as an idempotency key).

---

## How the mutation paths look after the refactor

This is the **invariant** every path must respect:

```
┌──────────────────────────────────────────────────────────────────┐
│  Entry points (all thin)                                          │
├──────────────────────────────────────────────────────────────────┤
│  POST /auth/signup     POST /auth/oauth/callback                  │
│  POST /auth/magic      POST /auth/passwordless/verify             │
│  POST /admin/users     <plugin>.signup(...)                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │  (every path calls the SAME service)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  SignupService.create(input, { source, actorId, tenantId })       │
│                                                                    │
│   1. Validate input                                                │
│   2. BEGIN TX                                                      │
│   3. Run hooks.user.beforeCreate(input, ctx)  ← can abort         │
│   4. INSERT nest_auth_user                                         │
│   5. INSERT nest_auth_user_access (if tenant context)              │
│   6. Run hooks.user.afterCreate(user, input, ctx)  ← can abort    │
│   7. (Plugin hooks run here in dependsOn order)                    │
│   8. INSERT nest_auth_outbox('user.created', payload)              │
│   9. COMMIT TX                                                     │
│  10. eventBus.emit('user.created', payload)  ← post-commit        │
│  11. Outbox poller delivers to durable subscribers (async)         │
└──────────────────────────────────────────────────────────────────┘
```

Every consumer can plug in at exactly one of those points based on its requirements.

---

## Decision matrix

Answer two questions and the pattern picks itself:

| Q1 — If this fails, should the auth action also fail? | Q2 — Do I need at-least-once delivery? | Pattern |
|---|---|---|
| Yes | n/a | **Hook** |
| No | Yes | **Outbox** |
| No | No (fire-and-forget OK) | **Event** |

If you also want to ship the integration as a reusable module: wrap in a **Plugin**.

---

## Same patterns, every entity

| Entity | `entity.created` | `entity.updated` | `entity.deleted` | Special |
|---|---|---|---|---|
| User | ✅ | ✅ (with `changedFields`) | ✅ (with snapshot) | `user.email-changed`, `user.mfa-enabled/disabled`, `user.password-changed` |
| Identity (OAuth link) | ✅ | — | ✅ | `identity.linked`, `identity.unlinked` |
| Role | ✅ | ✅ | ✅ | `role.permission-added`, `role.permission-removed` |
| Permission | ✅ | ✅ | ✅ | |
| Tenant | ✅ | ✅ | ✅ | `tenant.member-added`, `tenant.member-removed`, `tenant.member-role-changed` |
| UserAccess (membership) | ✅ | ✅ | ✅ | |
| Session | ✅ | — | ✅ (`session.revoked`) | `session.refreshed` |
| MfaSecret | ✅ | — | ✅ | `mfa.verified`, `mfa.failed` |
| ApiKey | ✅ | ✅ | ✅ | `api-key.used`, `api-key.expired` |
| AuditLog | — | — | — | append-only; emit via outbox if you want it streamed |

Each entry has the **same hook signature shape** so a consumer can mechanically write parallel handlers for User, Tenant, Role, etc.

---

## Delete-cascade design

The trickiest case. Three policies, configurable per relation:

| Policy | Behavior | When to use |
|---|---|---|
| `cascade` | Auth deletes user → `afterDelete` hook deletes related rows in same tx | Most cases. `AppUser` is meaningless without `AuthUser` |
| `restrict` | Auth's `beforeDelete` hook throws if related rows exist | Compliance: "user has invoices, can't be deleted, must be anonymized" |
| `nullify` | Auth deletes user → `afterDelete` hook sets `related.userId = NULL` | Audit log entries that should survive user deletion |

Consumer chooses in the hook handler — we don't enforce a global default. Recipe documented in [`/docs/recipes/cross-system-sync-cascade.mdx`](../apps/docs/content/docs/recipes/cross-system-sync-cascade.mdx) (T-154).

---

## Update propagation

If a consumer caches `email` in their `AppUser` row, they need `email` changes propagated. Use:

```ts
hooks: {
  user: {
    afterUpdate: async (user, prev, ctx) => {
      if (user.email !== prev.email) {
        await ctx.tx.getRepository(AppUser).update({ authUserId: user.id }, { email: user.email });
      }
    },
  },
},
```

Or subscribe to the more specific event:

```ts
@OnAuthEvent('user.email-changed')
async onEmailChanged(e: AuthEventMap['user.email-changed']) {
  await this.appUserRepo.update({ authUserId: e.userId }, { email: e.newEmail });
}
```

**Recommendation:** for fields you cache, use Pattern 1 (hook + tx). For notifications about the change, use Pattern 2 (event).

---

## Admin dashboard sync — the trap

A common bug: the admin dashboard takes a shortcut and writes directly to the repository, bypassing the use-case service. Then `user.created` doesn't fire for admin-created users. Consumer's CRM stays out of sync.

**The fix is structural, not "remember to emit":**

- Admin controllers (in `http/`) call `SignupService.create(...)` — **never** `userRepo.save()`.
- The service emits the canonical event with `source: 'admin.dashboard'` automatically.
- A lint rule (`no-direct-repo-mutation`) blocks any non-`application/`-layer code from calling `.save()` / `.insert()` / `.update()` / `.delete()` / `.softDelete()` on a `Repository<NestAuth*>`.

Enforcement task: **T-053b** (new — see below).

---

## Plugin authors: same rule

Plugins that create users (e.g. `oauth-google` after a successful callback) call `SignupService.create(..., { source: 'plugin.oauth-google' })`. The plugin **does not** write to `nest_auth_user` directly. Same for any other entity.

This is documented in the per-plugin `AGENTS.md` so AI agents extending plugins don't break the invariant.

---

## Rollback semantics — what happens when something fails

The user explicitly asked: **"if project-specific logic fails, we need to rollback the user (or any nest-auth action) we just created."** This is a core correctness concern. Below is the exact rollback behavior per pattern, plus the saga design for multi-step / multi-system flows.

### Rule 1 — Same-process, same-DB → automatic atomic rollback

When the consumer's work is a DB write to the SAME database as nest-auth, **Pattern 1 (hook with `ctx.tx`)** is the answer and it's already atomic:

```ts
hooks: {
  user: {
    afterCreate: async (user, input, ctx) => {
      // 1. nest_auth_user already inserted (still in tx, not committed)
      // 2. Consumer writes their own row using the SAME tx
      await ctx.tx.getRepository(AppUser).insert({ authUserId: user.id, /* ... */ });
      // 3. If this insert throws → tx aborts → both nest_auth_user AND app_user are gone.
      // 4. If billing is also needed: do it INSIDE this same hook, same tx.
      await ctx.tx.getRepository(BillingAccount).insert({ userId: user.id, /* ... */ });
      // Any throw here rolls back nest_auth_user as well.
    },
  },
},
```

**Guarantee:** all-or-nothing. No half-states. Same applies to `afterUpdate` and `afterDelete`.

This is what most consumers need. Same-DB consumer-table maintenance: **just use the tx from the context**.

### Rule 2 — Different-DB / external system → saga with explicit `compensate`

If consumer work touches **another database** (different connection), or an **external system** (Stripe, Salesforce, S3), the underlying DBMS can't roll it back for you. You need a saga: each step declares its `do` and `compensate` functions; if a later step fails, the framework runs the earlier `compensate` functions in reverse order.

We provide this as a built-in primitive:

```ts
import { Saga } from '@ackplus/nest-auth';

hooks: {
  user: {
    afterCreate: async (user, input, ctx) => {
      const saga = new Saga(ctx);

      // Step 1: same-DB write — uses the auth tx, auto-rollback
      saga.step({
        name: 'create-app-user',
        do:         () => ctx.tx.getRepository(AppUser).insert({ authUserId: user.id }),
        compensate: () => ctx.tx.getRepository(AppUser).delete({ authUserId: user.id }), // no-op if tx rolls back
      });

      // Step 2: external system — must compensate explicitly
      let stripeCustomerId: string | undefined;
      saga.step({
        name: 'create-stripe-customer',
        do:         async () => { stripeCustomerId = (await stripe.customers.create({ email: user.email })).id; },
        compensate: async () => { if (stripeCustomerId) await stripe.customers.del(stripeCustomerId); },
      });

      // Step 3: another internal service (different DB)
      let crmLeadId: string | undefined;
      saga.step({
        name: 'create-crm-lead',
        do:         async () => { crmLeadId = (await crmClient.createLead(user)).id; },
        compensate: async () => { if (crmLeadId) await crmClient.deleteLead(crmLeadId); },
      });

      // If step 3 throws:
      //   - step 3's compensate runs (but crmLeadId is undefined, so no-op — correct)
      //   - step 2's compensate runs (deletes the Stripe customer)
      //   - step 1 is in the auth tx, so it rolls back automatically when we re-throw
      //   - re-throw propagates to nest-auth → entire signup fails, no nest_auth_user row exists
      await saga.run();
    },
  },
},
```

**`Saga.run()` semantics:**
- Steps run in order. Each step's `do` completes before the next starts.
- If step N throws: run `compensate` for steps N-1, N-2, ..., 1 in reverse order.
- Any `compensate` that itself throws is **logged as critical**, but compensation continues for earlier steps (best-effort).
- After all compensations (or success), the saga rethrows the original error (so the auth tx aborts).
- If a compensation fails, an `OutOfBandRollbackRequiredEvent` fires with full payload — operators can pick it up via webhook/alert.

**Idempotency requirement:** `compensate` functions must be idempotent (safe to call multiple times). Standard saga discipline.

### Rule 3 — Fire-and-forget external work → outbox (not rollback)

For things that don't need rollback if they fail (sending welcome email, pushing analytics event, audit-logging to S3), use **Pattern 4 — outbox**. We don't try to undo a sent email. We retry until success.

- Auth write + outbox row insert are atomic (same tx).
- Background worker delivers; failures retried with exponential backoff.
- After N failed attempts → dead-letter event surfaces to operators.

Don't use saga for these. Use outbox.

### Rule 4 — The reverse direction: rollback an already-committed auth action

Sometimes a consumer realizes **after** the auth tx committed that the user shouldn't exist (e.g., async payment verification fails 30s after signup). The hook + saga model doesn't help here because we're past commit.

For this case we provide explicit **reversal APIs** that fire the proper `*.deleted` event so all subscribers cascade:

```ts
import { ReversalService } from '@ackplus/nest-auth';

// 30 seconds after signup, payment service detects fraud
@OnEvent('payment.fraud-detected')
async onFraud(event: { userId: string }) {
  await this.reversalService.deleteUser(event.userId, {
    source: 'plugin.fraud-detector',
    reason: 'payment-fraud',
    actorId: null,
  });
  // This:
  //  - opens a new tx
  //  - runs user.beforeDelete hooks (consumers cascade their own tables)
  //  - deletes nest_auth_user (cascading sessions, identities, etc.)
  //  - emits user.deleted event
  //  - commits
  //  - outbox dispatches downstream
}
```

This is **delete with full lifecycle**, not a hard SQL DELETE. The forward and reverse paths use the same hooks + events.

### Decision tree (the practical version)

```
Did my work fail INSIDE the auth tx (same DB, same process)?
│
├── YES → Throw. The auth tx auto-rolls back. Done.
│
└── NO → Did I touch an external system that needs explicit undo?
         │
         ├── YES → Use Saga with do/compensate per step. Saga handles ordered rollback.
         │
         └── NO → Is at-least-once delivery OK? (e.g. welcome email)
                  │
                  ├── YES → Use outbox. Retry on failure. Don't rollback the auth action.
                  │
                  └── NO → Use Saga even though the work is fire-and-forget,
                           because you want hard atomicity guarantees.
```

### "Rollback nest-auth from consumer-side" — what we explicitly DON'T do

- We do NOT provide "delete this user but somehow keep an audit hint." Use soft-delete + audit log.
- We do NOT provide cross-process distributed transactions (XA/2PC). Saga is the answer.
- We do NOT auto-retry hook bodies. A flaky hook is the consumer's responsibility to make idempotent (or to wrap in outbox).
- We do NOT provide a "time-travel" reverse-history. `ReversalService.deleteUser` runs the delete forward through the standard lifecycle.

### Tests that pin this down

| TC ID | Test |
|---|---|
| TC-NEW-rollback-1 | `afterCreate` hook throws → no `nest_auth_user` row exists (verified by raw SELECT after the test) |
| TC-NEW-rollback-2 | Saga step 3 throws → step 2 + step 1 `compensate` functions run in reverse order |
| TC-NEW-rollback-3 | Saga `compensate` itself throws → `OutOfBandRollbackRequiredEvent` fires with full saga payload; earlier compensations still attempted |
| TC-NEW-rollback-4 | `ReversalService.deleteUser` fires `user.beforeDelete` + cascades + `user.deleted` event |
| TC-NEW-rollback-5 | Outbox row written in same tx as user insert → row visible only after commit; if tx rolls back, no orphan outbox row |
| TC-NEW-rollback-6 | Idempotent compensate: calling step's compensate twice has same effect as calling once |

---

## Implementation tasks

These are **additions** to the existing task tracker. They drop into Phase 2 alongside T-053 (event bus) and T-054 (hook registry):

| New ID | Task | Effort | Depends |
|---|---|---|---|
| T-053a | Define typed `AuthEventMap` in `nest-auth-contracts` covering all 30+ events listed above | S | T-026 |
| T-053b | Lint rule + AST scan: block direct `.save/.insert/.update/.delete/.softDelete` on `Repository<NestAuth*>` outside `application/` layer | S | T-053 |
| T-054a | Implement `UserHooks`, `RoleHooks`, `TenantHooks`, `SessionHooks` typed interfaces in contracts + registry wiring | M | T-054 |
| T-054b | Implement transactional hook execution: pass `EntityManager` via `ctx.tx`; all writes (auth + hook) share one transaction | S | T-054a |
| T-054c | Implement `@OnAuthEvent('user.created')` decorator (typed wrapper around `@OnEvent`) for typed listener handlers | XS | T-053a |
| T-054d | Implement the **outbox** built-in plugin (table + poller + delivery mechanism) | M | T-085 (webhooks) |
| T-054e | Implement **`Saga`** primitive — ordered `do`/`compensate` steps, reverse-order rollback, idempotency guidance, `OutOfBandRollbackRequiredEvent` on compensate failure | M | T-054a |
| T-054f | Implement **`ReversalService`** — `deleteUser`, `deleteRole`, `deleteTenant`, etc. APIs that run full lifecycle delete (hooks + events + cascade), for consumers that need to "undo" after the auth tx already committed | S | T-054a |
| T-085a | Webhooks plugin reuses outbox for at-least-once delivery | included in T-085 | T-054d |

These get added to `task-tracker.md` formally after this design is reviewed. For now, the tracker will note "see [`cross-system-sync.md`](cross-system-sync.md)".

---

## What's wrong with the current code (and what changes)

| Current state | After this design |
|---|---|
| Hooks are config-passed functions with loose `any` types | Typed `UserHooks` / `RoleHooks` / `TenantHooks` interfaces from contracts |
| Events emitted by `EventEmitter2` with no payload type contract | `AuthEventMap` strict typing + `@OnAuthEvent` decorator |
| Hooks run after the DB write completes (post-commit) | Hooks run **inside** the transaction — failures roll back |
| Admin controllers + signup controller + OAuth callback each call repositories directly | All three call `SignupService.create(...)` — single source of truth |
| `user.created` fires only on `POST /auth/signup` | `user.created` fires on **every** create path, with a `source` discriminator |
| No outbox → CRM/Kafka deliveries are lost on crash | Optional outbox plugin for at-least-once delivery |
| No lint enforcement | AST scan + lint rule prevents future drift |

---

## Verification

- Test `TC-008` (event fires with correct payload) is expanded into per-source tests: TC-008a (api.signup), TC-008b (admin.dashboard), TC-008c (oauth callback), etc. **All must pass for the canonical-event invariant to hold.**
- Test `TC-010` (`beforeSignup` throwing aborts signup with no DB write) is the transactional-hook test.
- New test: `TC-NEW-cross-sync-1` — admin creates user via dashboard → consumer's `afterCreate` hook fires with `source: 'admin.dashboard'`.
- New test: `TC-NEW-cross-sync-2` — admin deletes user → consumer's `afterDelete` runs in same tx → if hook throws, user is NOT deleted.

---

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) §4 — Customization architecture (this is one of the three levels)
- [`task-tracker.md`](task-tracker.md) — T-053, T-053a/b, T-054, T-054a/b/c/d
- [`test-catalog.md`](test-catalog.md) — TC-008-012 (event/hook tests), TC-340-348 (hook lifecycle), plus the new cross-sync tests above
