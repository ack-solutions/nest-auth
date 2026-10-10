---
name: nest-auth-flutter
description: Build authentication in Flutter and Dart apps with the ACKPlus Nest Auth SDK (nest_auth_flutter). Use when adding or changing login, signup, social sign-in (Google, Apple), OTP or passwordless login, MFA, password reset, session restore, token storage, auth-gated navigation or role-based UI in a Flutter app that talks to a Nest Auth backend.
---

# Nest Auth for Flutter

`nest_auth_flutter` (pub.dev) is the Dart SDK for a [Nest Auth](https://ack-solutions.github.io/nest-auth/) backend. It has two layers:

- `NestAuthClient` — pure Dart HTTP client: every auth call, token storage, refresh and one retry on a 401.
- `NestAuthController` — a `ChangeNotifier` over the client for reactive UI (`status`, `user`, `isBusy`).

This skill covers the **app**. Server configuration (enabling a login method, MFA, tenancy, roles) is in the `nest-auth` skill; if the backend is in this repository and that skill is missing, install it with `npx @ackplus/nest-auth-skill --stack backend`.

## Who decides

**The user's instructions always win.** This skill gives recommended defaults for when the user has not said how they want something done. If they name an approach — Riverpod, Bloc or GetX instead of the controller, Dio for their API, their own storage, a particular navigation package — do it their way. Each reference lists the supported alternatives.

Raise a concern only for a real security or data-loss consequence. Say it once, then do what was asked.

## Workflow

1. **Inspect the project.** Read `pubspec.yaml`: Flutter/Dart version, state management (provider, Riverpod, Bloc, GetX), navigation (Navigator, go_router, auto_route), HTTP client (http, dio), and whether `nest_auth_flutter` is already a dependency. Find any existing `NestAuthClient` and reuse it.
2. **Find the backend** base URL in the project's config or flavors, and what it has enabled (ask, or read the backend's options if it is in the repo).
3. **Map the request** with the table below and read only those files.
4. **Build it in the project's style**: its widgets, state management and navigation. The snippets show SDK calls, not a required UI.
5. **Verify** with `flutter analyze`, and tell the user anything the backend or the platform setup still needs.

## Feature map

| The user asks for | Read |
|---|---|
| First-time setup: dependency, client, storage, app-start restore, auth-gated root | [references/setup.md](references/setup.md) |
| Login, signup, logout, verification, forgot/reset password, passwordless | [references/auth-flows.md](references/auth-flows.md) |
| Google or Apple sign-in, other providers | [references/social-login.md](references/social-login.md) |
| MFA step on login, recovery codes | [references/mfa.md](references/mfa.md) |
| State management, roles in the UI, calling the app's own API, tenants, errors | [references/state-and-api.md](references/state-and-api.md) |
| An endpoint the SDK does not wrap | [references/rest-api.md](references/rest-api.md) |

## Requirements (set by the library, not preferences)

- A running Nest Auth backend and its base URL (origin plus any global prefix).
- Mobile uses **header** token transport. The backend must not force cookie mode (`session.accessTokenType` unset or `'header'`).
- The feature must be enabled on the backend (Google config for Google sign-in, `mfa.enabled` for MFA, …).
- Keep `nest_auth_flutter` on the same version line as the backend's `@ackplus/nest-auth`.

## Recommended defaults, and what else is supported

| Decision | Recommended when the user has no preference | Also supported |
|---|---|---|
| Token storage | `SecureTokenStorage` (keychain / keystore) | `InMemoryTokenStorage`, or your own `TokenStorage` |
| State | `NestAuthController` + `ListenableBuilder` | provider, Riverpod, Bloc, GetX, or the client alone |
| Navigation gating | switch the root widget on `auth.status` | go_router `redirect` with `refreshListenable`, route guards |
| The app's own API calls | add `Authorization: Bearer` from `client.accessToken` | a Dio interceptor, or any HTTP client |
| Social sign-in | native plugins (`google_sign_in`, `sign_in_with_apple`) | any flow that yields a provider token |
| HTTP client inside the SDK | default `http.Client` | pass `httpClient` (custom timeouts, proxies, tests) |

## Care points

- UI checks hide things; the backend enforces access.
- Do not ship secrets in the app. OAuth client IDs are public; client secrets are not.
- A login can return `isRequiresMfa: true`; that user is not signed in yet (see `mfa.md`).
- Use a device-reachable base URL in development (`10.0.2.2` for the Android emulator, the machine's LAN IP on a physical device).

## Check before you use an API

Targets `nest_auth_flutter` 2.x. If a member here does not resolve, the installed package source (in the pub cache, or via the IDE) is the source of truth. Docs: https://ack-solutions.github.io/nest-auth/
