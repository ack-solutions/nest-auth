# AGENTS.md — `@ackplus/nest-auth-react`

> Thin React layer on top of `@ackplus/nest-auth-client`. Headless — no UI ships.

## What this package is

A React provider, hooks, guard components, HOCs, and Next.js App Router helpers. Wraps an `AuthClient` instance and surfaces its state through React Context.

## Source layout

```
src/
├── index.ts                        ← public barrel
├── context/
│   ├── auth-context.ts             ← React Context + AuthContextValue type
│   └── auth-provider.tsx           ← <AuthProvider> component
├── hooks/
│   ├── use-auth.ts                 ← useNestAuth() — full context kitchen sink
│   ├── use-user.ts                 ← useUser()
│   ├── use-session.ts              ← useSession()
│   ├── use-access-token.ts         ← useAccessToken()
│   ├── use-auth-status.ts          ← useAuthStatus() — status + derived booleans
│   └── use-has-role.ts             ← useHasRole(), useHasPermission()
├── guards/
│   ├── auth-guard.tsx              ← <AuthGuard>
│   ├── guest-guard.tsx             ← <GuestGuard>
│   ├── require-role.tsx            ← <RequireRole>
│   ├── require-permission.tsx      ← <RequirePermission>
│   ├── with-require-role.tsx       ← withRequireRole HOC + factory
│   └── with-require-permission.tsx ← withRequirePermission HOC + factory
├── next/
│   ├── next-auth-provider.tsx      ← <NextAuthProvider>
│   └── create-next-auth-helpers.ts ← createNextAuthHelpers({ getServerAuth, withAuth, createInitialState })
└── sync/
    └── cross-tab-sync.ts           ← CrossTabSync + createCrossTabSync()
```

## Public exports

- **Provider** — `<AuthProvider>` (SPA), `<NextAuthProvider>` (with SSR initial-state hydration). Plus `AuthContext`, `AuthContextValue`, `InitialAuthState`.
- **Hooks** — `useNestAuth`, `useUser`, `useSession`, `useAccessToken`, `useAuthStatus`, `useHasRole`, `useHasPermission`.
- **Guards** — `<AuthGuard>`, `<GuestGuard>`, `<RequireRole>`, `<RequirePermission>`. HOCs `withRequireRole`, `withRequirePermission`. Factories `createRequireRoleHOC`, `createRequirePermissionHOC`.
- **Next.js helpers** — `createNextAuthHelpers(config)` returning `{ getServerAuth, withAuth, createInitialState }`.
- **Cross-tab sync** — `CrossTabSync`, `createCrossTabSync()`, types `SyncEventType`, `SyncEvent`, `SyncHandler`.

Re-exports from `@ackplus/nest-auth-client`: `AuthClient`, `AuthClientConfig`, `StorageAdapter`, `HttpAdapter`, every type. Consumers who depend on this package don't need to install the client separately for types.

## Conventions

- **Headless.** Don't ship styled components, button libraries, or tailwind classes that lock consumers into a design system. Hooks + components that render `children` only.
- **Re-render minimization.** Each hook subscribes to a slice of context. Don't add a hook that returns the whole context unless it's `useNestAuth` (which is documented as the kitchen sink).
- **Guard components fall through.** Default behaviour when access is denied is to render `null` (or `fallback` prop). Don't hard-code redirects — pass `onAccessDenied` / `onUnauthenticated` callbacks.
- **Server-component compatible.** `<NextAuthProvider>` accepts an `initialState` prop that's serializable. The provider must not crash if rendered server-side; the actual subscription kicks in after hydration.
- **No DOM-only assumptions.** Don't reach for `window` in hooks without an `if (typeof window !== 'undefined')` guard. RSC + RN consumers will break.

## When you add a hook or guard

1. Implement under `src/hooks/` or `src/guards/`.
2. Re-export from `src/index.ts`.
3. Document on the matching docs page (`apps/docs/content/docs/react/hooks.mdx` or `guards.mdx`).
4. Add a usage example to `apps/example-react` or `apps/examples-next` if it's a major addition.

## Peer dep

`react ^18 || ^19`. `next-auth-provider` and the helpers are lazy-loaded so non-Next.js consumers don't pull in `next/headers` etc.

## Build

`tsup`. ESM output. `package.json` `type: "module"`.

## Docs

https://ack-solutions.github.io/nest-auth/docs/react
