---
name: nest-auth-react
description: Build authentication UI in React, Next.js or React Native / Expo apps with the ACKPlus Nest Auth SDKs (@ackplus/nest-auth-react, @ackplus/nest-auth-client, @ackplus/nest-auth-react-native). Use when adding or changing a login or signup screen, social login button, OTP or passwordless login, MFA step, password reset, protected routes, role or permission based UI, tenant switcher or session handling in a React-based frontend that talks to a Nest Auth backend.
---

# Nest Auth for React, Next.js and React Native

The frontend SDKs for a [Nest Auth](https://ack-solutions.github.io/nest-auth/) backend.

| Package | Use it in |
|---|---|
| `@ackplus/nest-auth-react` | React (Vite, CRA, Remix) and Next.js: provider, hooks, guards |
| `@ackplus/nest-auth-client` | the underlying client; also works without React |
| `@ackplus/nest-auth-react-native` | React Native / Expo: storage adapters, native sign-in, the same hooks |

This skill covers the **frontend**. Server configuration (enabling a login method, MFA, tenancy, roles) is in the `nest-auth` skill; if the backend is in this repository and that skill is missing, install it with `npx @ackplus/nest-auth-skill --stack backend`.

## Who decides

**The user's instructions always win.** This skill gives recommended defaults for when the user has not said how they want something done. If they name an approach — their own form library, their own state store, header tokens, a router-level check instead of guard components, raw `fetch` calls — do it their way. Every reference lists the supported alternatives.

Raise a concern only for a real security or data-loss consequence. Say it once, then do what was asked.

## Workflow

1. **Inspect the project.** Read `package.json`: framework (Vite, Next.js App or Pages Router, Expo), router, form and UI libraries, HTTP client, state library, and which `@ackplus/nest-auth*` packages are installed. Find any existing `AuthClient` / `AuthProvider` and extend it rather than adding a second one.
2. **Find the backend.** Locate the API base URL in the project's env/config. If the backend is reachable or in the repo, check what it has enabled (`GET /auth/client-config`, or its `NestAuthModule.forRoot` options) instead of assuming.
3. **Map the request** with the table below and read only those files.
4. **Build it in the project's style**: its components, form handling, routing and error display. The snippets here show the SDK calls, not a required UI.
5. **Verify** with the project's typecheck or build, and tell the user anything the backend still needs (an option enabled, a CORS origin, a provider client ID).

## Feature map

| The user asks for | Read |
|---|---|
| First-time setup: install, client, provider, attaching auth to API calls | [references/setup.md](references/setup.md) |
| Login, signup, logout, email verification, forgot/reset password, passwordless, social buttons | [references/auth-flows.md](references/auth-flows.md) |
| MFA step on login, authenticator enrolment, recovery codes | [references/mfa.md](references/mfa.md) |
| Protected routes, guest-only pages, role or permission based UI | [references/guards-and-roles.md](references/guards-and-roles.md) |
| Tenant picker, tenant switch, tenant-scoped login | [references/tenancy.md](references/tenancy.md) |
| Next.js: server components, middleware, Pages Router | [references/nextjs.md](references/nextjs.md) |
| React Native / Expo: storage, native Google and Apple sign-in | [references/react-native.md](references/react-native.md) |
| The client without React, axios/fetch integration, errors | [references/client-js.md](references/client-js.md) |
| An endpoint the SDK does not wrap, or calling the API by hand | [references/rest-api.md](references/rest-api.md) |

## Requirements (set by the library, not preferences)

- A running Nest Auth backend and its base URL (origin plus any global prefix, for example `https://api.example.com/api`).
- The feature must be enabled on the backend: a Google button needs `google` configured there, an MFA step needs `mfa.enabled`, and so on.
- Cookie transport needs the API and the app on the same site (or correctly configured cross-site cookies) and CORS with credentials on the backend.
- Keep every `@ackplus/nest-auth*` package on the same version, and only one copy of `@ackplus/nest-auth-react` installed.

## Recommended defaults, and what else is supported

| Decision | Recommended when the user has no preference | Also supported |
|---|---|---|
| State | `AuthProvider` + hooks | `AuthClient` directly with the project's own store |
| Token transport, web | http-only `cookie` | `header` with local/session/memory/custom storage |
| Token transport, React Native | `header` with secure storage | AsyncStorage or any `StorageAdapter` |
| API calls | attach the client to the project's axios/fetch | `getAuthHeaders()` per request; cookies alone in cookie mode |
| Route protection | `AuthGuard` / `GuestGuard` | HOCs, router loaders, the project's own wrapper |
| Role-based UI | `RequirePermission` / `useHasPermission` | role checks, `hasRole` / `hasPermission` helpers |
| Forms and UI | the project's existing libraries | anything; the SDK has no UI of its own |
| Which login options to show | read `useClientConfig()` | hard-code them if the user prefers |

## Care points

- UI checks hide things; they do not secure them. The backend enforces access.
- Do not put secrets in frontend code. OAuth client IDs are public; client secrets are not.
- `login` can succeed with `isRequiresMfa: true`; that user is not signed in yet (see `mfa.md`).
- A network error is not a logout. Only a 401/403 from the session check ends the session (`error.kind`).

## Check before you use an API

Targets Nest Auth 2.x. If a symbol here does not resolve, the installed types in `node_modules/@ackplus/*/dist` are the source of truth. Docs: https://ack-solutions.github.io/nest-auth/
