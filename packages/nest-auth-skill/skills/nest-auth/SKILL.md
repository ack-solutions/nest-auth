---
name: nest-auth
description: Set up and configure ACKPlus Nest Auth (@ackplus/nest-auth) in a NestJS backend, or call it from a plain JS/TS client or any HTTP client. Use when adding or changing login, signup, email/password, social login (Google, GitHub, Facebook, Apple), OTP or passwordless, MFA, sessions and tokens, roles and permissions, multi-tenancy, API keys or other auth configuration on the server, or when the project depends on @ackplus/nest-auth.
---

# ACKPlus Nest Auth

Nest Auth is a NestJS auth module with a REST API and official client SDKs.

| Package | Use it in |
|---|---|
| `@ackplus/nest-auth` | NestJS backend (TypeORM) |
| `@ackplus/nest-auth-client` | any JS/TS client (browser, Node) |
| `@ackplus/nest-auth-react` | React and Next.js (wraps the client) |
| `@ackplus/nest-auth-react-native` | React Native / Expo |
| `nest_auth_flutter` (pub.dev) | Flutter / Dart |

Any other client (Vue, Angular, Svelte, a mobile app in another language, another backend) can use the JS client or call the REST API directly.

## Companion skills

This skill covers the **backend** and framework-agnostic clients. Frontend work has its own skills, installed by the same command when the project uses that stack:

- **`nest-auth-react`** — React, Next.js, React Native / Expo UI: provider, hooks, guards, screens.
- **`nest-auth-flutter`** — Flutter / Dart apps.

If the task is frontend work and the matching skill is installed, use it. If it is not installed, either run `npx @ackplus/nest-auth-skill --stack react` (or `--stack flutter`), or work from `client-js.md` / `rest-api.md` here.

## Who decides

**The user's instructions always win.** This skill gives recommended defaults for when the user has not said how they want something done. If the user names an approach — header tokens in a browser app, their own HTTP client, raw REST calls instead of the SDK, their own guard, a custom UI, a particular mail provider, extra features switched on — do it their way. Every reference file lists the supported alternatives; none of them is "wrong".

Raise a concern only when a choice has a real security or data-loss consequence. Say it once, briefly, then do what was asked.

## Workflow

1. **Inspect the project before editing.** Read `package.json` (or `pubspec.yaml`) for the stack, the installed `@ackplus/nest-auth*` packages and versions, and the package manager. Find any existing `NestAuthModule.forRoot` / `forRootAsync`, `AuthClient` or `AuthProvider` and extend it rather than adding a second one.
2. **Map the request to features** with the table below. Read only those reference files.
3. **Implement what was asked.** If the request is open ("add login"), use the recommended defaults. Do not switch on features nobody asked for; suggest them instead.
4. **Fit the project.** Use its config/env loading, folder layout, HTTP client, form and UI libraries, mail/SMS service and code style.
5. **Verify.** Run the project's typecheck or build. Tell the user which env vars and provider-console settings they must supply.

Ask a question only when the answer changes the design and the code cannot tell you. The usual cases: the tenancy model, and which mail/SMS service to use when the project has none.

## Feature map

| The user asks for | Read |
|---|---|
| First-time backend setup, entities, `main.ts`, protecting routes | [references/backend-setup.md](references/backend-setup.md) |
| Any option: what it does, its default, where it is explained | [references/config-reference.md](references/config-reference.md) |
| Email or phone + password, signup, verification, reset, invitations | [references/email-password.md](references/email-password.md) |
| Google, GitHub, Facebook, Apple or a custom OAuth/SSO provider | [references/social-login.md](references/social-login.md) |
| OTP login, passwordless | [references/passwordless-otp.md](references/passwordless-otp.md) |
| MFA / 2FA, TOTP, recovery codes, trusted devices | [references/mfa.md](references/mfa.md) |
| Cookie vs header tokens, refresh, session store, session list/revoke, CORS | [references/sessions-tokens.md](references/sessions-tokens.md) |
| Roles, permissions, guards on routes or UI | [references/roles-permissions.md](references/roles-permissions.md) |
| Multi-tenant, organizations, workspaces, tenant switch | [references/multi-tenancy.md](references/multi-tenancy.md) |
| Rate limiting, lockout, CAPTCHA, CSRF, password policy, API keys, audit | [references/security.md](references/security.md) |
| Plain JS/TS client (Vue, Angular, Svelte, Node), axios/fetch integration | [references/client-js.md](references/client-js.md) |
| Calling the API without an SDK (any language or HTTP client) | [references/rest-api.md](references/rest-api.md) |
| Events, hooks, async config, custom providers, admin console, platform admins | [references/advanced.md](references/advanced.md) |

A new backend needs `backend-setup.md` first. Feature files show the server options and the framework-agnostic client calls; React and Flutter screens are in the companion skills.

## Requirements (set by the library, not preferences)

- The backend is NestJS with TypeORM. Clients can be anything that speaks HTTP.
- `session.jwt.secret` is mandatory; the app does not boot without it.
- `EventEmitterModule.forRoot()` must be registered, and the `NestAuthEntities` must be known to TypeORM.
- **Codes are not sent by the library.** Verification, reset, passwordless, MFA and invitation flows emit an event carrying the code or token. The app sends the email or SMS. A flow with no listener delivers nothing.
- Cookie transport needs `cookie-parser` and CORS with `credentials: true` and explicit origins.
- `ISOLATED` tenant mode needs a `tenantId` on login and signup.
- Keep every `@ackplus/nest-auth*` package in a project on the same version.

## Recommended defaults, and what else is supported

| Decision | Recommended when the user has no preference | Also supported |
|---|---|---|
| Client code | Official SDK for the stack | REST API directly, from any language (`rest-api.md`) |
| Token transport, browser | http-only `cookie` | `header` with local/session/memory or custom storage |
| Token transport, mobile / server | `header` | — |
| Protecting routes | `@Auth()` per controller or route | Global `APP_GUARD` + `@Public()`; your own guard on top |
| Module config | `forRoot` | `forRootAsync` (`useFactory` / `useClass` / `useExisting`) |
| Session storage | Database | Redis, memory, or a custom `SessionStore` |
| Side effects (mail, audit, sync) | Events | Hooks, when the flow must wait for or be changed by your code |
| Authorization | Permissions on routes, grouped into roles | Role checks, custom resolvers, your own guard |
| App-specific user fields | A separate entity keyed by the auth user id | `metadata` on the auth user; `user.getSessionUserData` |
| UI | The project's own components calling SDK hooks | SDK guard components and HOCs; fully custom logic on the client |
| Features to enable | Only what the request needs | Anything in `config-reference.md`, when asked |

## Care points

- Changing `session.accessTokenType`, the JWT secret, `tenant.mode` or `routePrefix` in an existing app signs users out or breaks deployed clients. Do it when asked, and tell the user the effect first.
- Turning on tenancy for an app that already has users needs a data migration. Agree the plan before changing data.
- If the project uses `synchronize: false`, schema changes go through its migration tooling.
- Read secrets from the project's config. Do not write real secrets into code, and do not log codes, tokens or passwords outside local development.
- The embedded admin console is **on** by default. Mention it; turn it off with `adminConsole: { enabled: false }` if the user does not want it.

## Check before you use an API

This skill targets Nest Auth 2.x. If a symbol here does not resolve, or the installed version is older, the installed types in `node_modules/@ackplus/*/dist` are the source of truth. Full docs: https://ack-solutions.github.io/nest-auth/
