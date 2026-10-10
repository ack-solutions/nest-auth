---
name: nest-auth
description: Implement authentication with ACKPlus Nest Auth (@ackplus/nest-auth) in NestJS backends and React, Next.js, React Native, Flutter or plain JS/TS clients. Use when adding or changing login, signup, email/password, social login (Google, GitHub, Facebook, Apple), OTP or passwordless, MFA, sessions and tokens, roles and permissions, multi-tenancy or API keys, or when the project already depends on an @ackplus/nest-auth package.
---

# ACKPlus Nest Auth

Nest Auth is a NestJS auth module plus official client SDKs. Use the SDKs. Do not hand-roll JWT handling, password hashing, token refresh, OTP or session code that the packages already provide.

| Package | Use it in |
|---|---|
| `@ackplus/nest-auth` | NestJS backend (TypeORM) |
| `@ackplus/nest-auth-client` | any JS/TS client (browser, Node) |
| `@ackplus/nest-auth-react` | React and Next.js (wraps the client) |
| `@ackplus/nest-auth-react-native` | React Native / Expo |
| `nest_auth_flutter` (pub.dev) | Flutter / Dart |

All packages release together. Keep every `@ackplus/nest-auth*` package in a project on the same version.

## Workflow

1. **Inspect the project before editing.** Read `package.json` (or `pubspec.yaml`) to find: the stack, which `@ackplus/nest-auth*` packages and versions are installed, and the package manager (lockfile). Find any existing `NestAuthModule.forRoot` / `forRootAsync`, `AuthClient` or `AuthProvider` and extend it. Never add a second one.
2. **Map the request to features** with the table below and read only those reference files.
3. **Add the minimum.** Change only the options the request needs. See the rules below.
4. **Follow the project's conventions**: its config/env loading, folder layout, HTTP client, form and UI libraries, and code style.
5. **Verify**: run the project's typecheck or build. Tell the user which env vars and provider-console settings they must supply. Never invent secrets or commit real ones.

Ask the user a question only when the answer changes the design and you cannot infer it from the code. The usual cases are the tenancy model (see `multi-tenancy.md`) and missing credentials.

## Feature map

| The user asks for | Read |
|---|---|
| First-time backend setup, entities, `main.ts`, protecting routes | [references/backend-setup.md](references/backend-setup.md) |
| Email or phone + password, signup, email verification, forgot/reset password | [references/email-password.md](references/email-password.md) |
| Google, GitHub, Facebook or Apple login | [references/social-login.md](references/social-login.md) |
| OTP login, passwordless, magic code | [references/passwordless-otp.md](references/passwordless-otp.md) |
| MFA / 2FA, TOTP, recovery codes, trusted devices | [references/mfa.md](references/mfa.md) |
| Cookie vs header tokens, refresh, session store, CORS | [references/sessions-tokens.md](references/sessions-tokens.md) |
| Roles, permissions, guards on routes or UI | [references/roles-permissions.md](references/roles-permissions.md) |
| Multi-tenant, organizations, workspaces, tenant switch | [references/multi-tenancy.md](references/multi-tenancy.md) |
| Plain JS/TS client, axios/fetch integration | [references/client-js.md](references/client-js.md) |
| React provider, hooks, route guards | [references/react.md](references/react.md) |
| Next.js App Router, server auth, middleware | [references/nextjs.md](references/nextjs.md) |
| React Native, Expo, Flutter | [references/mobile.md](references/mobile.md) |
| Hooks, events, rate limiting, lockout, CAPTCHA, API keys, admin console, async config | [references/advanced.md](references/advanced.md) |

A new backend always needs `backend-setup.md` first. A frontend task needs the matching client file plus the feature file.

## Rules

**Enable only what was asked for.** These are off by default and stay off unless requested: multi-tenancy, MFA, phone login, passwordless, every social provider, rate limiting, lockout, CAPTCHA, platform access. Email + password is on by default. The embedded admin console is also **on** by default: set `adminConsole: { enabled: false }` unless the user wants it (see `advanced.md`).

**Do not break an existing app.**
- Changing `session.accessTokenType`, the JWT secret, `tenant.mode`, or `routePrefix` invalidates sessions or changes every client. Do not change them as a side effect.
- Adding tenancy or changing `tenant.mode` on an app with existing users needs a data plan. Stop and ask.
- Schema changes: if the project uses `synchronize: false`, generate a migration with the project's own tooling. Do not turn `synchronize` on.

**Security defaults.**
- Read secrets from the project's config/env system. `session.jwt.secret` should be at least 32 random bytes.
- Browser apps: prefer `accessTokenType: 'cookie'` (http-only). Mobile and server-to-server: `'header'`.
- Cookie mode needs `cookie-parser`, CORS with `credentials: true` and an explicit origin list.
- Verification, reset, passwordless and MFA **codes are not sent by the library**. It emits an event with the code; the app must send the email or SMS. A flow without a listener silently delivers nothing. See `advanced.md` → Events.
- Never log codes, tokens or passwords outside local development.

**Check before you use an API.** This skill targets Nest Auth 2.x. If the installed version is older than a feature needs, or a symbol here does not resolve, read the installed package's types in `node_modules/@ackplus/*/dist` and follow them. Full docs: https://ack-solutions.github.io/nest-auth/
