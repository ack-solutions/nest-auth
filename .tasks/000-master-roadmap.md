---
id: 000
priority: P0
area: all
status: open
package: monorepo
title: Master roadmap — architecture refactor, plugin system, file restructure, test strategy, examples, docs
---

## Summary

This is the single source of truth for the `nest-auth` v2 effort. It supersedes scattered notes and combines:

1. **Architecture refactor** — split god-services, eliminate `forwardRef` hell, layer the codebase cleanly.
2. **Plugin system** — first-class class-based plugins. Every built-in feature becomes a plugin. Consumers add new auth methods without forking.
3. **Customization model** — three-level override (config / plugins / DI-token replacements) with a sealed security core.
4. **File restructure** — clean DDD-lite layout: `core` / `domain` / `application` / `http` / `events` / `hooks` / `plugins`.
5. **Test strategy** — real-test-only, defined in detail in [`test-catalog.md`](test-catalog.md).
6. **Example apps** — rebuilt from scratch, one per scenario, with full coverage of the SDK surface.
7. **Documentation** — human docs (Fumadocs + Scalar API ref), AI-agent docs (`AGENTS.md` per feature + `llms.txt`).
8. **Phased delivery** — 6 phases, ~12-16 weeks total, sequenced so each phase is independently shippable.

Treat sections 2-8 as the design; section 9 as the execution plan.

---

## 1. Current state (3-line recap)

The package is mature on the surface (9 auth methods, MFA, multi-tenancy, admin UI, contracts pkg) but suffers from a 1,226-LOC `AuthService`, 18 `forwardRef` declarations, 0% test coverage, hand-maintained OpenAPI, a no-op ISOLATED tenant mode, and an admin UI that can't do bulk actions or impersonation. Full evidence: see the existing 24 files in `.tasks/`.

---

## 2. North-star architecture

Three architectural shifts. Everything else flows from them.

### 2.1 Layered, plugin-first

```
┌─────────────────────────────────────────────────────────┐
│  HTTP layer        controllers · guards · interceptors  │
├─────────────────────────────────────────────────────────┤
│  Application       use cases (signup, login, refresh)   │
├─────────────────────────────────────────────────────────┤
│  Domain            entities · repositories · services   │
├─────────────────────────────────────────────────────────┤
│  Core              config · crypto · errors · logger    │
└─────────────────────────────────────────────────────────┘
        ▲                                       ▲
        │       Events bus · Hook registry      │
        └───────────┐                ┌──────────┘
                    │                │
                ┌───┴────────────────┴───┐
                │   Plugin system        │
                │   (built-ins + custom) │
                └────────────────────────┘
```

- **Lower layers know nothing of higher layers.** Domain never imports HTTP. Core never imports domain.
- **Plugins attach via the event bus, hook registry, and DI token overrides** — never by direct class import of another plugin or of HTTP/application code.

### 2.2 Every feature is a plugin

The built-in auth methods (email/password, phone/password, magic link, passwordless email, passwordless SMS, Google/GitHub/Facebook/Apple OAuth, TOTP MFA, email-OTP MFA, SMS-OTP MFA, recovery codes, trusted devices, API keys, audit log, admin console) all ship as plugins inside the package. The user enables them in `forRoot({ plugins: [...] })`. There's no second class of feature.

### 2.3 Tenant as a first-class entity at the DB layer

Per [`.tasks/019`](019-isolated-mode-not-actually-isolated.md) / [`.tasks/022`](022-sessions-tenantid-not-a-column.md) / [`.tasks/024`](024-mfa-not-tenant-scoped-design-undocumented.md): `tenantId` becomes a proper column on `sessions`, `identities`, `mfa_secrets`, `trusted_devices` (nullability mode-dependent). The three modes (DISABLED / SHARED / ISOLATED) all do what they claim.

---

## 3. Plugin architecture (deep design)

Informed by research of [Better Auth](https://better-auth.com/docs/concepts/plugins), [SuperTokens recipes](https://supertokens.com/docs/references/backend-sdks/api-overrides), [Strapi v5 plugins](https://docs.strapi.io/cms/plugins-development/developing-plugins), [Medusa v2 modules](https://docs.medusajs.com/learn/fundamentals/modules), [Backstage extension points](https://backstage.io/docs/backend-system/architecture/extension-points/), and NestJS native patterns (`DynamicModule`, `DiscoveryService`, custom providers).

### 3.1 What we keep from each peer

| Pattern | Source | Why for us |
|---|---|---|
| Class-based plugin with `id`/`version`/lifecycle | Strapi + NestJS conventions | Idiomatic to Nest DI; decorators work; testable |
| `originalImplementation` override pattern | SuperTokens | Smallest-blast-radius override; we'll implement via Nest DI tokens + decorator wrapping |
| Manifest-driven admin UI extension | Backstage + Strapi admin/server split | Frontend code never gets injected by the server bundle — security and bundling win |
| Topological sort of `dependsOn` | Backstage | Predictable load order; fail-fast on cycles |
| Migration namespacing per plugin | Medusa | No collision when 5 plugins all want `0001_init.sql` |
| Sealed core / consent-based override | Browser extension model | Plugins can't no-op MFA without explicit user opt-in |
| Manifest-then-client-package for client mirror | Better Auth `$InferServerPlugin` | Start with manifest in v1, paired packages in v2 for type ergonomics |
| Cross-module isolation (no FK across plugins) | Medusa | Avoids the spaghetti when 20 plugins are installed |

### 3.2 The `NestAuthPlugin` contract

Abstract class. Plugins extend it. Instances are passed to `NestAuthModule.forRoot({ plugins: [new EmailPasswordPlugin(...)] })`.

```ts
// packages/nest-auth/src/plugins/plugin.contract.ts (design)

export abstract class NestAuthPlugin {
  /** Unique kebab-case id. Used in routes, migrations, error attribution. */
  abstract readonly id: string;

  /** Plugin's own semver. Surfaces in /auth/_meta. */
  abstract readonly version: string;

  /** Range of @ackplus/nest-auth core versions this plugin supports. */
  abstract readonly coreVersion: string; // e.g. '^2.0.0'

  /** Ids of other plugins this one requires. Validated at forRoot. */
  readonly dependsOn?: string[];

  /** Ids that must NOT be present alongside this one. */
  readonly conflictsWith?: string[];

  /** DI tokens this plugin will rebind. Declared up-front so collisions are caught at forRoot. */
  readonly overrides?: symbol[];

  // ─── Declarative contributions (read at registration) ───────────────

  /** TypeORM entities owned by this plugin. Namespaced table names recommended. */
  entities?(): EntityClassOrSchema[];

  /** Standard Nest providers. May rebind tokens declared in `overrides`. */
  providers?(ctx: PluginContext): Provider[];

  /** Controllers mounted under /auth/plugin/:id/* (enforced by host). */
  controllers?(): Type<unknown>[];

  /** Dynamic modules to import. Rare; prefer providers/controllers. */
  imports?(): Array<Type | DynamicModule>;

  /** Migrations owned by this plugin. Run in dependsOn order. */
  migrations?(): MigrationClass[];

  /** Auth methods this plugin contributes (declarative — enables /auth/methods enumeration). */
  authMethods?(): AuthMethodDefinition[];

  /** Admin UI pages, returned to the admin SPA via /auth/admin/api/manifest. */
  adminUI?(): AdminPageManifest[];

  /** Error codes this plugin emits. Merged into a global registry. */
  errorCodes?(): Record<string, { code: string; httpStatus: number; message: string }>;

  // ─── Lifecycle (invoked by host) ─────────────────────────────────────

  /** Runs during forRoot, before DI graph is built. Validate config here. */
  onRegister?(ctx: PluginContext): void | Promise<void>;

  /** Runs in OnApplicationBootstrap. All services available. Subscribe events, seed data. */
  onBootstrap?(ctx: PluginContext): void | Promise<void>;

  /** Runs in OnApplicationShutdown. Close connections, flush. */
  onShutdown?(ctx: PluginContext): void | Promise<void>;

  // ─── Event subscriptions (declarative; alternative to onBootstrap+bus) ──

  events?(): Array<{ event: keyof AuthEventMap; handler: EventHandler<unknown> }>;
}
```

`PluginContext` gives the plugin scoped access to: `config` (filtered view of `IAuthModuleOptions`), `eventBus` (typed), `hookRegistry`, `logger` (prefixed with `[plugin:<id>]`), `coreServices` (read-only handles to the sealed core).

### 3.3 The override mechanism (DI tokens + sealed core)

**Step 1: every replaceable core dependency is bound to a public symbol.**

```ts
// packages/nest-auth/src/core/tokens.ts
export const PASSWORD_HASHER  = Symbol('NEST_AUTH:PASSWORD_HASHER');
export const SESSION_STORE    = Symbol('NEST_AUTH:SESSION_STORE');
export const USER_REPOSITORY  = Symbol('NEST_AUTH:USER_REPOSITORY');
export const EMAIL_SENDER     = Symbol('NEST_AUTH:EMAIL_SENDER');
export const SMS_SENDER       = Symbol('NEST_AUTH:SMS_SENDER');
export const OTP_CODEC        = Symbol('NEST_AUTH:OTP_CODEC');
export const CLOCK            = Symbol('NEST_AUTH:CLOCK');
// ... ~15 tokens total

// SEALED — cannot be overridden (security-critical):
export const JWT_SIGNER       = Symbol.for('NEST_AUTH:SEALED:JWT_SIGNER');
export const SESSION_VALIDATOR= Symbol.for('NEST_AUTH:SEALED:SESSION_VALIDATOR');
export const TENANT_GUARD     = Symbol.for('NEST_AUTH:SEALED:TENANT_GUARD');
```

**Step 2: core registers defaults.**

```ts
// in CoreModule providers
{ provide: PASSWORD_HASHER, useClass: BcryptHasher },
{ provide: SESSION_STORE,   useClass: DbSessionStore },
// ...
```

**Step 3: a plugin replaces.**

```ts
class Argon2Plugin extends NestAuthPlugin {
  id = 'argon2';
  version = '1.0.0';
  coreVersion = '^2.0.0';
  overrides = [PASSWORD_HASHER];

  providers() {
    return [{ provide: PASSWORD_HASHER, useClass: Argon2Hasher }];
  }
}
```

**Step 4: collision detection.** At `forRoot`, the host scans `plugin.overrides[]` arrays; if two plugins claim the same token → throw at boot:

```
NestAuthError: Token PASSWORD_HASHER bound by both plugins:
  - argon2 (1.0.0)
  - scrypt (0.3.0)
Resolve by removing one or by passing { allowOverrideConflicts: ['PASSWORD_HASHER'] } in forRoot.
```

**Step 5: sealed tokens.** Any plugin attempting to override a `Symbol.for('NEST_AUTH:SEALED:*')` token → throw at boot. To extend (not replace) sealed behavior, plugins use the decorator pattern: register a wrapper that delegates to the sealed default.

```ts
// Allowed: wrapping (decorator)
providers() {
  return [
    SessionValidatorWithAuditWrapper, // wraps SESSION_VALIDATOR — does not replace
  ];
}
```

This is **SuperTokens' `originalImplementation` pattern adapted to Nest DI**. The override surface is intentional (declared `overrides` array) so users see at a glance what their plugin tree does.

### 3.4 Built-in plugins (everything is a plugin)

| Plugin id | What | Replaces today's |
|---|---|---|
| `email-password` | Email + password auth | Part of `AuthService` |
| `phone-password` | Phone + password auth | Part of `AuthService` |
| `magic-link` | Email-link login | Part of passwordless |
| `passwordless-email` | Email OTP login | Part of passwordless |
| `passwordless-sms` | SMS OTP login | Part of passwordless |
| `mfa-totp` | TOTP MFA | `MfaService` part |
| `mfa-email-otp` | Email OTP MFA | `MfaService` part |
| `mfa-sms-otp` | SMS OTP MFA | `MfaService` part |
| `mfa-recovery-codes` | Recovery codes | `MfaService` part |
| `mfa-trusted-devices` | Trusted device list | `MfaService` part |
| `oauth-google` | Google OAuth | `GoogleAuthProvider` |
| `oauth-github` | GitHub OAuth | `GitHubAuthProvider` |
| `oauth-facebook` | Facebook OAuth | `FacebookAuthProvider` |
| `oauth-apple` | Apple OAuth | `AppleAuthProvider` |
| `api-keys` | API key auth | (existing code) |
| `organizations` | Tenant management (DISABLED/SHARED/ISOLATED) | `TenantModule` |
| `audit-log` | Structured audit logging | `AuditService` |
| `admin-console` | Embedded admin UI + API | `AdminConsoleModule` |
| `webhooks` (new) | Outbound webhook delivery on auth events | — |
| `rbac` | Roles + permissions + guards | `RoleModule` + `PermissionModule` |

Default `forRoot` enables a sensible subset; users opt in/out explicitly.

### 3.5 Security model — what plugins can and can't do

| Capability | Default | How granted |
|---|---|---|
| Add new auth method | ✅ Allowed | Declare via `authMethods()` |
| Mount controllers under `/auth/plugin/:id/*` | ✅ Allowed | Default. Cannot mount on other paths. |
| Subscribe to events | ✅ Allowed | `events()` or `eventBus.on()` in `onBootstrap` |
| Add own entities (table prefix = `nest_auth_plugin_<id>_*`) | ✅ Allowed | `entities()` |
| Override non-sealed core token (e.g. `PASSWORD_HASHER`) | ⚠️ Requires declaration in `overrides[]` and unique among plugins | Plus optional consumer-side `allowOverrides: [TOKEN]` if you want belt-and-suspenders |
| Override sealed token (`JWT_SIGNER`, `SESSION_VALIDATOR`, `TENANT_GUARD`) | ❌ Forbidden — boot throws | Use decorator wrappers instead |
| Read other plugins' state | ❌ Forbidden | DI scope; plugin tree is opaque |
| Add cross-plugin foreign keys | ❌ Forbidden | Use link tables (Medusa pattern) |
| Modify `process.env` | ❌ Forbidden by convention | Receive `PluginContext.config` view instead |

### 3.6 Lifecycle and load order

1. `forRoot({ plugins: [...] })` collects plugin instances.
2. Validate each plugin's `coreVersion` against `CORE_VERSION` constant (`semver.satisfies`).
3. Build dependency graph from `dependsOn`. Topological sort via Kahn's algorithm. **Cycle → throw with the cycle path**.
4. Validate `conflictsWith`. Conflict → throw.
5. Validate `overrides[]` collision across plugins. Collision → throw.
6. Call each plugin's `onRegister(ctx)` in sorted order (no DI yet — declarative phase).
7. Host synthesizes the final `DynamicModule`:
   - `entities` → merged into the TypeORM `DataSource` configuration.
   - `providers` → flat list with override tokens taking precedence.
   - `controllers` → registered, with route-prefix guard ensuring `/auth/plugin/:id/*`.
8. Nest builds DI graph.
9. `OnApplicationBootstrap` → for each plugin in sorted order, call `onBootstrap(ctx)`; subscribe `events()`.
10. App ready. Diagnostic log emitted: resolved plugin tree, override map, registered endpoints.

### 3.7 Server ↔ client plugin pairing

**Phase 1 (ship first): manifest-driven.** Server plugin returns:

```ts
clientManifest(): ClientManifestEntry {
  return {
    id: 'oauth-google',
    actions: {
      startLogin: { method: 'POST', path: '/auth/plugin/oauth-google/start', input: GoogleStartSchema, output: GoogleStartResponseSchema },
      callback:   { method: 'POST', path: '/auth/plugin/oauth-google/callback', input: GoogleCallbackSchema, output: AuthResponseSchema },
    },
    events: ['oauth-google:linked', 'oauth-google:unlinked'],
  };
}
```

The client SDK fetches `/auth/_meta` at init, generates typed RPC stubs from the Zod schemas. One network roundtrip, no plugin code on the client. Works for plugins published after the client was built.

**Phase 2 (later): paired npm packages.** Optional `@yourorg/nest-auth-passkey/client` mirrors the server plugin and is added to `createAuthClient({ plugins: [passkeyClient()] })`, gaining `$InferServerPlugin`-style end-to-end type inference (Better Auth's pattern).

We ship Phase 1 in v2.0. Phase 2 is a v2.x additive.

### 3.8 Admin UI plugin pages

Plugins return an `AdminPageManifest`:

```ts
adminUI(): AdminPageManifest[] {
  return [{
    id: 'oauth-google-settings',
    route: '/plugins/oauth-google',
    title: 'Google OAuth',
    icon: 'google',
    permission: 'admin.plugins.read',
    bundleUrl: '/auth/admin/api/plugin-bundle/oauth-google.js',
    integrity: 'sha384-...',   // SRI hash
    mountMode: 'esm' | 'iframe', // iframe by default for untrusted plugins
  }];
}
```

The admin SPA fetches `/auth/admin/api/manifest`, renders nav items, and dynamically imports the bundle. ESM mount for trusted (first-party) plugins; iframe + `postMessage` for third-party plugins (CSP isolation).

### 3.9 Versioning + compatibility

- Plugins declare `version` (their own) and `coreVersion` (the core range they support).
- Core declares `CORE_VERSION` constant; mismatch → fail at boot with link to migration guide.
- Each core breaking change requires a new major version + per-token MIGRATION.md.
- The plugin ecosystem is encouraged to follow semver strictly; we publish a compatibility matrix in docs.

---

## 4. Customization & override architecture

Consumer's mental model: **3 levels of customization, in order of preference**.

### Level 1 — Config (simplest)

```ts
NestAuthModule.forRoot({
  appName: 'Acme',
  jwt: { secret: env.JWT_SECRET, accessTtl: '15m', refreshTtl: '30d' },
  password: { minLength: 12, requireMixedCase: true },
  cookie: { sameSite: 'strict', secure: true },
  plugins: [
    emailPasswordPlugin(),
    organizationsPlugin({ mode: 'shared' }),
    mfaTotpPlugin(),
  ],
});
```

90% of consumers stop here. No code, just settings.

### Level 2 — Plugins (add behavior)

```ts
plugins: [
  ...defaultPlugins,
  myCompanyOAuthPlugin({ clientId: env.SAML_CLIENT_ID }),
  webhooksPlugin({ url: env.WEBHOOK_URL, secret: env.WEBHOOK_SECRET }),
  customAuditPlugin({ sink: 'datadog' }),
]
```

Add features without forking. Plugin = self-contained unit (entities, routes, hooks, migrations).

### Level 3 — Token overrides (replace behavior)

```ts
class Argon2HasherPlugin extends NestAuthPlugin {
  id = 'argon2';
  overrides = [PASSWORD_HASHER];
  providers() {
    return [{ provide: PASSWORD_HASHER, useClass: Argon2Hasher }];
  }
}
```

For the few who need it. Sealed tokens (JWT signing, session validation, tenant guard) require the decorator pattern instead of replacement.

### Level 0 — Hook into existing flow (no override)

```ts
plugins: [
  ...defaultPlugins,
  {
    id: 'custom-signup-hook',
    version: '1.0.0',
    coreVersion: '^2.0.0',
    events: () => [
      { event: 'user.registered', handler: async (e) => {
          await myCrm.createLead(e.user.email);
      }},
    ],
  } satisfies NestAuthPlugin,
]
```

Plain object satisfies the contract for tiny one-offs.

### What about HTTP-route override?

If a consumer needs to fully replace `POST /auth/login` — e.g. with custom rate limiting or response shape — they:

1. Disable the built-in plugin: `emailPasswordPlugin({ enabled: false })`.
2. Mount their own controller at `/auth/login` with their logic, reusing core services injected via tokens (`USER_REPOSITORY`, `SESSION_STORE`, etc.).

We document this as a recipe in the docs.

### What about extending the user entity?

Two paths:

1. **Custom fields in `metadata` JSON** — zero schema change, hooks (`beforeSignup`, `transformResponse`) write/read.
2. **Plugin-owned related entity** — `OrganizationProfilePlugin` adds a `profiles` table with FK to user. Linked via link table per Medusa's isolation rule.

We deliberately do **not** support "extending `NestAuthUser` with extra columns" — that breaks our schema discipline and causes migrations to drift. The metadata-or-related-entity rule is enforced.

---

## 5. File structure reorganization

### 5.1 Current (cleaned up summary)

```
packages/nest-auth/src/lib/
├── nest-auth.module.ts          ← god module: imports all submodules
├── auth.constants.ts            ← error codes, event names, providers (mixed)
├── core/                        ← ⚠️ "core" contains auth providers (Google, GitHub...) which aren't core
│   ├── providers/               ← OAuth + email + phone + JWT providers, all in one folder
│   ├── services/                ← JWT, AuthConfig, DebugLogger, AuthProviderRegistry
│   ├── interfaces/
│   ├── decorators/
│   └── dto/
├── auth/                        ← god module: controllers, services, MFA, OAuth orchestration
│   ├── auth.module.ts           ← 67 LOC; imports 6 forwardRef
│   ├── controllers/             ← auth + mfa controllers (huge)
│   ├── services/                ← AuthService (1226 LOC), MfaService, others
│   ├── entities/                ← OTP, MFA secret, trusted device
│   ├── events/                  ← event class definitions
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   └── dto/
├── session/
├── user/
├── role/
├── permission/
├── tenant/
│   └── tenant-context/services/ ← BUG: isolated.service is empty
├── admin-console/               ← god module: 5 forwardRef
│   └── static/                  ← built UI bundle copied here on build
├── audit/
├── request-context/
└── utils/
```

Pain: "core" isn't core, "auth" is everything, 18 `forwardRef`, no plugin boundary, admin UI is half-coupled.

### 5.2 Target

```
packages/nest-auth/src/
├── index.ts                                ← curated public API only
├── nest-auth.module.ts                     ← thin dynamic module; delegates to PluginRegistry
├── nest-auth.constants.ts                  ← public error codes, event names, version
│
├── core/                                   ← INFRASTRUCTURE. No domain knowledge.
│   ├── core.module.ts                      ← @Global(); exports infra services
│   ├── tokens.ts                           ← every public DI token (PASSWORD_HASHER, etc.)
│   ├── config/
│   │   ├── auth-config.service.ts
│   │   ├── config-validation.ts            ← Zod schemas for IAuthModuleOptions
│   │   └── module-options.token.ts
│   ├── crypto/
│   │   ├── password-hasher.interface.ts    ← port
│   │   ├── bcrypt-hasher.ts                ← default adapter, bound to PASSWORD_HASHER
│   │   ├── jwt-signer.interface.ts         ← SEALED port
│   │   ├── jsonwebtoken-signer.ts          ← bound to JWT_SIGNER (sealed)
│   │   ├── otp-codec.interface.ts
│   │   └── hmac-otp-codec.ts
│   ├── clock/
│   │   ├── clock.interface.ts              ← port for testable time
│   │   └── system-clock.ts                 ← bound to CLOCK
│   ├── errors/
│   │   ├── nest-auth.error.ts              ← base class
│   │   ├── error-codes.ts                  ← all codes as const
│   │   └── auth-exception.filter.ts
│   ├── logger/
│   │   └── debug-logger.service.ts
│   └── request-context/
│       ├── request-context.middleware.ts
│       ├── request-context.service.ts
│       └── decorators/                     ← @CurrentUser, @CurrentTenantId
│
├── domain/                                 ← always-present entities + repositories
│   ├── user/
│   │   ├── user.entity.ts
│   │   ├── user-identity.entity.ts
│   │   ├── user.repository.ts              ← interface; bound to USER_REPOSITORY
│   │   ├── user.typeorm-repository.ts      ← default adapter
│   │   ├── user-normalizer.service.ts      ← email/phone normalization
│   │   └── user.module.ts
│   ├── session/
│   │   ├── session.entity.ts
│   │   ├── session.repository.ts
│   │   ├── stores/
│   │   │   ├── session-store.interface.ts  ← bound to SESSION_STORE
│   │   │   ├── db-session.store.ts
│   │   │   ├── redis-session.store.ts
│   │   │   └── memory-session.store.ts
│   │   ├── session-manager.service.ts
│   │   └── session.module.ts
│   ├── role/
│   ├── permission/
│   ├── tenant/
│   │   ├── tenant.entity.ts
│   │   ├── user-access.entity.ts
│   │   ├── tenant.repository.ts
│   │   ├── tenant.service.ts
│   │   ├── tenant-context/
│   │   │   ├── tenant-context.service.ts   ← strategy interface
│   │   │   ├── disabled.context.ts
│   │   │   ├── shared.context.ts
│   │   │   └── isolated.context.ts         ← actually does isolation (post-.tasks/019)
│   │   └── tenant.module.ts
│   └── audit/
│       ├── audit-log.entity.ts
│       ├── audit-log.repository.ts
│       └── audit.module.ts
│
├── application/                            ← use cases — orchestrate domain
│   ├── signup/
│   │   ├── signup.service.ts               ← extracted from AuthService
│   │   ├── signup.dto.ts
│   │   └── signup.events.ts
│   ├── login/
│   │   ├── login.service.ts
│   │   ├── login.dto.ts
│   │   └── login.events.ts
│   ├── refresh/
│   ├── logout/
│   ├── password/
│   │   ├── change-password.service.ts
│   │   ├── forgot-password.service.ts
│   │   └── reset-password.service.ts
│   ├── tenant/
│   │   ├── switch-tenant.service.ts
│   │   └── current-tenant.service.ts
│   ├── verification/
│   │   ├── verify-email.service.ts
│   │   └── verify-phone.service.ts
│   └── application.module.ts
│
├── http/                                   ← transport layer
│   ├── controllers/
│   │   ├── auth.controller.ts              ← thin: parse DTO, call use case, return
│   │   ├── session.controller.ts
│   │   ├── tenant.controller.ts
│   │   ├── password.controller.ts
│   │   └── verification.controller.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── roles.guard.ts
│   │   ├── permissions.guard.ts
│   │   ├── require-guard.guard.ts
│   │   └── tenant.guard.ts
│   ├── interceptors/
│   │   └── auto-refresh.interceptor.ts
│   ├── pipes/
│   │   └── normalize-identifier.pipe.ts
│   ├── dto/
│   │   ├── requests/
│   │   └── responses/
│   └── http.module.ts
│
├── events/                                 ← strongly-typed event bus
│   ├── event-bus.service.ts                ← wraps EventEmitter2
│   ├── event-names.ts                      ← string literal union
│   ├── event-payloads.ts                   ← per-event payload types
│   ├── auth-event-map.ts                   ← `type AuthEventMap = { 'user.registered': RegisteredPayload; ... }`
│   └── events.module.ts
│
├── hooks/                                  ← typed hook registry
│   ├── hook-registry.service.ts
│   ├── hook-types.ts
│   └── hooks.module.ts
│
├── plugins/                                ← plugin system + built-ins
│   ├── plugin.contract.ts                  ← abstract NestAuthPlugin class
│   ├── plugin-context.ts
│   ├── plugin-registry.service.ts          ← dep graph, topo sort, conflict detection
│   ├── plugin-loader.ts                    ← turns plugin instances into providers/entities/...
│   ├── plugins.module.ts
│   ├── AGENTS.md                           ← "How to write a plugin" — for humans + agents
│   └── built-in/
│       ├── email-password/
│       │   ├── email-password.plugin.ts
│       │   ├── email-password.controller.ts
│       │   ├── email-password.service.ts
│       │   ├── email-password.dto.ts
│       │   ├── README.md
│       │   └── AGENTS.md
│       ├── phone-password/
│       ├── magic-link/
│       ├── passwordless-email/
│       ├── passwordless-sms/
│       ├── mfa-totp/
│       │   ├── mfa-totp.plugin.ts
│       │   ├── mfa-totp.controller.ts
│       │   ├── mfa-totp.service.ts
│       │   ├── entities/
│       │   │   └── mfa-secret.entity.ts
│       │   └── migrations/
│       ├── mfa-email-otp/
│       ├── mfa-sms-otp/
│       ├── mfa-recovery-codes/
│       ├── mfa-trusted-devices/
│       ├── oauth-google/
│       ├── oauth-github/
│       ├── oauth-facebook/
│       ├── oauth-apple/
│       ├── api-keys/
│       ├── organizations/                  ← multi-tenancy
│       ├── audit-log/
│       ├── webhooks/
│       └── rbac/
│
└── utils/                                  ← pure functions only (no DI)
    ├── normalize-email.ts
    ├── normalize-phone.ts
    ├── cookie.helper.ts
    └── timing-safe-compare.ts

packages/nest-auth/test/                    ← real-test-only, see test-catalog.md
├── helpers/
│   ├── boot-test-app.ts                    ← Test.createTestingModule + app.init
│   ├── postgres-container.ts               ← Testcontainers Postgres
│   ├── redis-container.ts
│   ├── oauth-stub-server.ts                ← real Express stub for Google/GitHub/etc.
│   ├── email-capture.transport.ts          ← real EmailSender impl that writes to in-memory store
│   └── sms-capture.transport.ts
├── fixtures/
│   ├── users.factory.ts
│   ├── tenants.factory.ts
│   └── roles.factory.ts
├── scenarios/
│   ├── shared-mode.scenario.ts
│   ├── isolated-mode.scenario.ts
│   └── mfa-enrolled-user.scenario.ts
├── unit/                                   ← pure-function tests (no DB)
├── integration/                            ← full module + real DB
└── e2e/                                    ← cross-package, Playwright in apps/

packages/nest-auth-admin/                   ← NEW: UI extracted from nest-auth/ui/
├── src/
│   ├── server/                             ← backend pieces of admin (controllers, etc.)
│   └── ui/                                 ← React/Vite SPA
├── package.json
└── ...

packages/nest-auth-client/                  ← (cleanup phase)
├── src/
│   ├── client/
│   │   ├── auth-client.ts                  ← thin facade
│   │   ├── auth-client/                    ← splits of the 1067-LOC class
│   │   │   ├── password-actions.ts
│   │   │   ├── mfa-actions.ts
│   │   │   ├── oauth-actions.ts
│   │   │   ├── session-actions.ts
│   │   │   └── tenant-actions.ts
│   │   ├── event-emitter.ts
│   │   └── refresh-queue.ts
│   ├── storage/  http/  token/  types/  utils/
│   └── plugins/                            ← client-side plugin contract (Phase 2)
│       └── plugin.contract.ts

packages/nest-auth-react/                   ← (mostly stays as-is, cleanup only)

packages/nest-auth-contracts/               ← (cleanup only; remove duplicate exports, consolidate CookieOptions)
```

### 5.3 Migration steps

1. Create new folder structure alongside old (no deletions).
2. Move files one feature at a time; update imports.
3. After each feature: rerun the test suite (this is why testing must come first).
4. Once a feature is fully moved, delete old location.
5. Update barrel `index.ts` files to control the public surface.
6. Final pass: `tsc --noEmit` clean, lint clean, no `forwardRef` left (or each remaining one has a comment justifying it).

---

## 6. Test strategy (REAL TESTS ONLY)

Full catalog in [`test-catalog.md`](test-catalog.md). The headline rule:

> **No mocking of internal classes, services, or repositories.** Tests exercise real implementations exactly as production does. Testcontainers for DB/Redis. Real backend booted in-process for client tests. Local Express stub servers for third-party OAuth.

Phase 1 of this roadmap implements the harness (~60 tests). Subsequent phases add tests as features land.

---

## 7. Example apps (rebuilt from scratch)

### 7.1 What's wrong with current examples

- `apps/example-react` README is the Vite default template (zero auth content).
- `apps/example-nest` README links to wrong paths.
- No example covers multi-tenancy.
- No example covers OAuth UI.
- No example covers MFA UI.
- No example covers building a plugin.
- No vanilla-JS example.

### 7.2 New example apps

| Folder | Stack | Demonstrates |
|---|---|---|
| `apps/example-nest-minimal` | NestJS + SQLite + email/password only | Smallest possible setup — 1 file, 30 lines |
| `apps/example-nest-full` | NestJS + Postgres + every built-in plugin enabled | Every config knob, hooks, events, custom user fields, audit log |
| `apps/example-nest-multitenant` | NestJS + Postgres, ships all 3 tenant modes as separate `forRoot` configs the user toggles via env | Real demonstration of DISABLED/SHARED/ISOLATED differences |
| `apps/example-react-spa` | React 19 + Vite + nest-auth-react | Every hook, every guard, complete login/signup/MFA/forgot-password/social UI flows |
| `apps/example-next-app-router` | Next.js 15 App Router + middleware + server actions | SSR cookie reading, protected routes, server actions calling auth |
| `apps/example-next-pages-router` | Next.js Pages Router (optional, lower priority) | Legacy support |
| `apps/example-vanilla-js` | Plain HTML + ESM script | Framework-agnostic client usage |
| `apps/example-plugin-custom-oauth` | LinkedIn OAuth as a third-party plugin in its own folder | How to write a plugin from scratch — referenced in docs |
| `apps/example-plugin-extra-field` | "Profile photo + bio" plugin adding a related entity | The right way to extend user data |
| `apps/example-react-native` (future, P3) | Expo + nest-auth-client | Mobile demonstration; defers plugins |

### 7.3 Coverage matrix

Each example app must demonstrate at least these SDK touchpoints:

| Touchpoint | -minimal | -full | -multitenant | -react-spa | -next | -vanilla | -plugin |
|---|---|---|---|---|---|---|---|
| Signup | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Logout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Forgot/reset password | — | ✓ | — | ✓ | ✓ | — | — |
| Email/phone verification | — | ✓ | — | ✓ | ✓ | — | — |
| MFA setup + login | — | ✓ | — | ✓ | ✓ | — | — |
| OAuth (Google) | — | ✓ | — | ✓ | ✓ | — | — |
| API keys | — | ✓ | — | — | — | ✓ | — |
| Multi-tenant signup | — | — | ✓ | ✓ | ✓ | — | — |
| Switch tenant | — | — | ✓ | ✓ | ✓ | — | — |
| Hook: beforeSignup | — | ✓ | — | — | — | — | — |
| Event: user.registered | — | ✓ | — | — | — | — | — |
| Custom user field | — | ✓ | — | — | — | — | — |
| Plugin registration | — | — | — | — | — | — | ✓ |
| Plugin override token | — | — | — | — | — | — | ✓ |
| Plugin events subscription | — | — | — | — | — | — | ✓ |
| Plugin admin UI page | — | — | — | — | — | — | ✓ |
| Admin console embed | — | ✓ | ✓ | — | — | — | — |
| Cross-tab sync | — | — | — | ✓ | ✓ | — | — |
| SSR session read | — | — | — | — | ✓ | — | — |

Each example has its own README with screenshots/recording, a Stackblitz/CodeSandbox embed link in the docs, and is exercised by E2E tests so it never silently rots.

---

## 8. Documentation strategy

### 8.1 Two audiences, two formats

**Humans:**
- Fumadocs site (existing). Restructured per audit:
  - Delete 30 mechanical API-reference MDX pages.
  - Replace with one page embedding **Scalar** (`@scalar/api-reference-react`) sourced from the live OpenAPI generated by the (un-stubbed) `build-openapi.ts`.
  - Add missing sections: **Testing guide**, **Migration 1.x→2.0**, **Security hardening**, **Admin console walkthrough**, **Multi-tenancy worked example**, **Writing a plugin (tutorial)**.
  - Fix stale READMEs in example apps.

**AI agents:**
- `AGENTS.md` at root (exists; expand with extension recipes).
- `AGENTS.md` per major folder (`core/`, `domain/`, `application/`, `http/`, `plugins/`).
- `AGENTS.md` per built-in plugin folder (so an agent extending oauth-google has a template to follow).
- New file: `llms.txt` at root + per package — machine-readable index of public exports, error codes, extension points, recipes.
- Error codes exported from `nest-auth-contracts` as `const` (not just docs) so client code can match on them.

### 8.2 API reference: Scalar

- Add `@scalar/api-reference-react` to the docs site.
- One page `/docs/api-reference/` renders the full OpenAPI spec interactively (search, "try it out", code samples in 10 languages).
- Replaces the 30 auto-generated MDX endpoint pages.
- Spec sourced from `apps/docs/public/api/nest-auth.json` — but that file is now generated by a real `build-openapi.ts` (Phase 1).

### 8.3 Plugin development docs

Plugin docs structure (under `/docs/plugins/`):
1. **Concept** — what a plugin is, what it can do.
2. **Quickstart** — a 50-line "hello world" plugin.
3. **Reference** — every field of `NestAuthPlugin`.
4. **Recipes** — add OAuth provider, add custom user field, add admin page, override password hasher, subscribe to event, ship migrations.
5. **Publishing** — semver, coreVersion, marketplace conventions.
6. **Security** — what your plugin should and should not do.

Each recipe links to a working example in `apps/example-plugin-*/`.

---

## 9. Phased delivery plan

### Phase 1 — Foundation (1-2 weeks)

Goal: nothing user-visible; everything below is risky without this.

| # | Work | Tests added |
|---|---|---|
| 1.1 | Vitest + Testcontainers (Postgres + Redis) harness in `nest-auth` | TC-001 to TC-053 (~50) |
| 1.2 | Real-backend boot helper for `nest-auth-client` tests; remove planned `msw` usage | TC-400 to TC-408 |
| 1.3 | Real OpenAPI generator: boot example-nest headless → `SwaggerModule.createDocument()` → write JSON. Closes [`.tasks/005`](005-build-openapi-script-is-stub.md) | TC-365 |
| 1.4 | Add `@ApiResponse` to admin controllers + servers/tags to spec. Closes [`.tasks/007`](007-admin-controllers-missing-api-response-decorators.md), [`.tasks/016`](016-openapi-spec-no-servers-and-no-tags.md) | TC-322 |
| 1.5 | Unify `packages/nest-auth/ui/` into pnpm workspace; delete `yarn.lock` | — |
| 1.6 | CI: build + test + lint + OpenAPI-diff check (GitHub Actions) | — |
| 1.7 | Fix duplicate `export *` in `nest-auth-client/src/index.ts:60` | — |
| 1.8 | Consolidate the three `CookieOptions` definitions into one in contracts | — |

**Deliverable:** repo can be tested. CI red/green is meaningful. OpenAPI is real.

### Phase 2 — Architecture refactor (3-4 weeks)

Goal: split god-services, layer the code, eliminate `forwardRef`.

| # | Work | Tests added |
|---|---|---|
| 2.1 | Create new folder structure (`core/`, `domain/`, `application/`, `http/`, `events/`, `hooks/`) alongside existing | — |
| 2.2 | Split `AuthService` (1226 LOC) → `SignupService`, `LoginService`, `PasswordService`, `RefreshService`, `LogoutService`, all ≤300 LOC | TC-001 to TC-167 stay green |
| 2.3 | Split `AdminUsersController` → 4 controllers mirroring UI tabs | TC-310 to TC-322 stay green |
| 2.4 | Eliminate the 18 `forwardRef` declarations (move shared services into `core/` or `domain/`, use event bus for cross-module signaling) | — |
| 2.5 | Strict-type the event bus: `AuthEventMap` with per-event payload types | TC-341 |
| 2.6 | Define DI tokens for replaceable services (`tokens.ts`) | — |
| 2.7 | Wrap signup/role-assignment/password-reset in DB transactions | TC-010, TC-214 |
| 2.8 | Add compound unique index `(provider, providerId)` on identities | TC-073 |
| 2.9 | Move `sessions.tenantId` from JSON to real column. Closes [`.tasks/022`](022-sessions-tenantid-not-a-column.md) | TC-139, TC-140 |
| 2.10 | Delete old folder structure files; final import-path cleanup | — |

**Deliverable:** clean layered structure. `AuthService` is gone (now thin facade). Tests still pass. `forwardRef` count ≤2 (or zero, with justification per remaining one).

### Phase 3 — Plugin system extraction (2-3 weeks)

Goal: introduce `NestAuthPlugin` contract and convert built-in features.

| # | Work | Tests added |
|---|---|---|
| 3.1 | Implement `NestAuthPlugin` abstract class + `PluginRegistry` (dep graph, topo sort, conflict detection, override validation) | TC-380 to TC-392 |
| 3.2 | Implement `PluginLoader` (entities → datasource, providers/controllers → DynamicModule) | — |
| 3.3 | Implement sealed-token mechanism (`Symbol.for('NEST_AUTH:SEALED:*')` check) | TC-386 |
| 3.4 | Convert `email-password` to a plugin (template for all others) | tests stay green |
| 3.5 | Convert remaining auth methods: `phone-password`, `magic-link`, `passwordless-*`, `mfa-*`, `oauth-*`, `api-keys` | tests stay green |
| 3.6 | Convert `audit-log` and `webhooks` (new) plugin | — |
| 3.7 | Convert `rbac` and `organizations` plugins | tests stay green |
| 3.8 | Convert `admin-console` to a plugin (still bundled by default) | tests stay green |
| 3.9 | `forRoot({ plugins: [...] })` API; legacy `IAuthModuleOptions` deprecated with adapter layer for one minor version | — |
| 3.10 | Manifest endpoint `/auth/_meta` exposing plugin tree + client schemas | — |

**Deliverable:** every feature is a plugin. Consumers can disable built-ins. Custom plugins work.

### Phase 4 — Multi-tenancy done right (2-4 weeks)

| # | Work | Tests added |
|---|---|---|
| 4.1 | RFC: ISOLATED mode — choose Option A (strict row-level + fail-closed) per [`.tasks/019`](019-isolated-mode-not-actually-isolated.md) | — |
| 4.2 | Implement chosen ISOLATED behavior | TC-270 to TC-277 |
| 4.3 | Add `tenantId` column to `mfa_secrets`, `trusted_devices`, `identities` (nullable in shared, required in isolated). Closes [`.tasks/024`](024-mfa-not-tenant-scoped-design-undocumented.md) | TC-106, TC-275, TC-276 |
| 4.4 | Harden `switchTenant` + refresh: explicit mode guards, membership re-check on refresh. Closes [`.tasks/020`](020-refresh-after-switchtenant-fragility.md) | TC-124, TC-253, TC-254 |
| 4.5 | Per-tenant `AuthMethodConfig`: tenant A allows email+google, tenant B is SAML-only | TC-NEW |
| 4.6 | Per-tenant password policy / MFA policy / session-duration overrides | TC-NEW |
| 4.7 | Reopen [`.tasks/021`](021-user-email-not-unique-at-db-layer.md) — add proper unique constraint per mode | TC-014 |

**Deliverable:** all three tenant modes do what the docs claim. Enterprise customers can configure per-tenant.

### Phase 5 — Admin UI redesign (3-4 weeks)

| # | Work | Tests added |
|---|---|---|
| 5.1 | Extract `packages/nest-auth/ui/` → `packages/nest-auth-admin/` standalone workspace package | TC-1000+ |
| 5.2 | Generate API client from OpenAPI (replaces hand-written types) | — |
| 5.3 | Add TanStack Query (caching, refetch-on-focus, dedup) | — |
| 5.4 | Replace custom `<Table>` with TanStack Table (sorting, filtering, column visibility, row selection) | — |
| 5.5 | Rewrite User Detail page: 9 modals → single tabbed editable form with unsaved-changes guard | TC-1007 |
| 5.6 | Bulk actions, CSV export, advanced filters, impersonation, session revocation, MFA reset, force password reset, per-user audit log | TC-1005, TC-1055 |
| 5.7 | Audit Log page | TC-1056 |
| 5.8 | Tenant Detail page with member list, settings, branding | — |
| 5.9 | Admin UI plugin surface: `registerAdminPage()`, `extendUserDetailTabs()`, `addTableAction()`, CSS-var theme tokens for white-label | TC-389 |
| 5.10 | Cmd+K command palette, keyboard shortcuts, toast notifications | TC-1057 |

**Deliverable:** production-grade admin. Customizable. Extensible by plugins. White-labelable.

### Phase 6 — Examples + Docs (2-3 weeks, parallelizable with Phase 5)

| # | Work |
|---|---|
| 6.1 | Build the 7 new example apps per section 7.2 |
| 6.2 | Each example has README + screenshots + Stackblitz embed |
| 6.3 | E2E tests against each example (so they don't rot) — TC-800 to TC-814 |
| 6.4 | Embed Scalar in docs site `/api-reference/` page |
| 6.5 | Delete 30 mechanical API-reference MDX pages |
| 6.6 | Write missing docs: Testing, Migration 1.x→2.0, Security hardening, Admin walkthrough, Multi-tenancy worked example, Writing a plugin tutorial |
| 6.7 | `AGENTS.md` per top-level folder + per built-in plugin |
| 6.8 | `llms.txt` at root and per package |
| 6.9 | Export error codes as `const` from `nest-auth-contracts` |
| 6.10 | Fix stale READMEs in example apps |

**Deliverable:** docs reflect current code, agents can author plugins without re-reading source, every example demonstrates a real use case.

### Timeline summary

| Phase | Weeks | Parallelizable with |
|---|---|---|
| 1 — Foundation | 1–2 | — (must come first) |
| 2 — Architecture | 3–4 | — |
| 3 — Plugin system | 2–3 | Phase 4 (partly) |
| 4 — Multi-tenancy | 2–4 | Phase 5 (partly) |
| 5 — Admin UI | 3–4 | Phase 6 (mostly) |
| 6 — Examples + Docs | 2–3 | Phase 5 |
| **Total wall-clock** | **~12–16 weeks** | with parallelism |

---

## 10. Open decisions

These need a yes/no from you before the relevant phase starts.

| # | Decision | Phase | Recommendation |
|---|---|---|---|
| D1 | ISOLATED mode: row-level enforcement (Option A) or per-DB physical isolation (Option B, larger) | 4 | **Option A** — ship in v2, defer Option B to v3 |
| D2 | Plugin system: introduce in Phase 3 or defer to Phase 7? | 3 | **Phase 3** — Phase 4's per-tenant configs are ugly without it |
| D3 | Extract admin UI to its own package? | 5 | **Yes** — independent versioning, optional install, white-label |
| D4 | Per-tenant auth method config (Phase 4.5/4.6) — real demand or speculative? | 4 | **Real** if you have any enterprise interest; otherwise defer |
| D5 | Server↔client plugin pairing: manifest only (v1), paired npm packages later, or both from start? | 3 | **Manifest only in v1**, paired packages in v2.x |
| D6 | Webhooks plugin: build it now (Phase 3.6) or defer? | 3 | **Build now** — small effort, frequently requested |
| D7 | SAML/SSO plugin: in v2 scope or v3? | — | **v3** unless explicit customer ask |
| D8 | Drop `example-next-pages-router` to save effort? | 6 | **Drop** unless you know of a consumer on Pages Router |
| D9 | Mutation testing (Stryker) — adopt in Phase 1 or defer? | 1 | **Defer** — Vitest coverage is enough for v2.0 |
| D10 | Hard-deprecate `IAuthModuleOptions` in v2.0 or keep adapter for one minor? | 3 | **Keep adapter** — softer migration for existing consumers |

---

## 11. Quick reference for AI agents

If you (an AI agent) are continuing this work, here's where things live:

| You want to... | Look at... |
|---|---|
| Add a new auth method | `packages/nest-auth/src/plugins/built-in/<name>/` — copy `email-password/` as template |
| Override a core service | Define a plugin with `overrides: [TOKEN]` and `providers: () => [{ provide: TOKEN, useClass: MyImpl }]` |
| Hook into a lifecycle event | Plugin's `events: () => [{ event: 'user.registered', handler: ... }]` |
| Add an admin UI page | Plugin's `adminUI: () => [{ route, title, bundleUrl, ... }]` |
| Change a tenant mode | `forRoot({ plugins: [organizationsPlugin({ mode: 'shared' })] })` |
| Add a custom user field | Use `metadata` JSON column + `beforeSignup`/`transformResponse` hooks, OR write a plugin with a related entity |
| Test a new feature | Add real-test integration spec in `packages/nest-auth/test/integration/`. **No mocks** — see [`test-catalog.md`](test-catalog.md) §No-mock policy |
| Find the public API surface | `packages/<pkg>/src/index.ts` is the only authoritative list |
| Find existing bugs | `.tasks/` directory; status field tells you open/fixed |
| Reference a test in a PR | Use the `TC-NNN` ID from [`test-catalog.md`](test-catalog.md) |

---

## Verification

This roadmap is done when:
- All 6 phases shipped and tagged as v2.0.0.
- 100% of items in this file have a corresponding `.tasks/NNN-*.md` (or are explicitly closed below).
- Every fixed task in `.tasks/` has a regression test in [`test-catalog.md`](test-catalog.md) section J.
- Three production consumers (internal or external) have migrated from v1.x to v2 and signed off.

## Related

- [`test-catalog.md`](test-catalog.md) — ~520 test cases, real-test-only
- [`audit-types.md`](audit-types.md) — type/enum duplication audit (referenced in Phase 1.7/1.8)
- [`005-build-openapi-script-is-stub.md`](005-build-openapi-script-is-stub.md) — Phase 1.3
- [`007-admin-controllers-missing-api-response-decorators.md`](007-admin-controllers-missing-api-response-decorators.md) — Phase 1.4
- [`013-no-test-coverage-on-any-package.md`](013-no-test-coverage-on-any-package.md) — Phase 1.1
- [`016-openapi-spec-no-servers-and-no-tags.md`](016-openapi-spec-no-servers-and-no-tags.md) — Phase 1.4
- [`017-switchtenant-no-mode-guard.md`](017-switchtenant-no-mode-guard.md) — closed; regression in TC-2017
- [`018-disabled-mode-silently-discards-tenantid.md`](018-disabled-mode-silently-discards-tenantid.md) — closed; regression in TC-2018
- [`019-isolated-mode-not-actually-isolated.md`](019-isolated-mode-not-actually-isolated.md) — Phase 4.2
- [`020-refresh-after-switchtenant-fragility.md`](020-refresh-after-switchtenant-fragility.md) — Phase 4.4
- [`021-user-email-not-unique-at-db-layer.md`](021-user-email-not-unique-at-db-layer.md) — Phase 4.7
- [`022-sessions-tenantid-not-a-column.md`](022-sessions-tenantid-not-a-column.md) — Phase 2.9
- [`024-mfa-not-tenant-scoped-design-undocumented.md`](024-mfa-not-tenant-scoped-design-undocumented.md) — Phase 4.3
