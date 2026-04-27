# AGENTS.md — `@ackplus/nest-auth-client`

> Framework-agnostic JS/TS client. Zero peer deps. Works in browsers, Node, RN, Workers, Deno, Bun.

## What this package is

A single `AuthClient` class that wraps the HTTP API of `@ackplus/nest-auth`. Responsibilities:

- Token storage (header or cookie mode)
- Auto-refresh on 401 with `RefreshQueue` deduplication
- All auth method shortcuts (`signup`, `login`, `logout`, `passwordlessSend`, `verify2fa`, …)
- Event subscription API (`onTokensSet`, `onTokenRefreshed`, `onLogout`, …)
- Pluggable storage adapters and HTTP adapters

## Source layout

```
src/
├── index.ts                       ← public barrel
├── client/
│   ├── auth-client.ts             ← THE class (1067 lines, ~70 methods)
│   ├── event-emitter.ts           ← internal generic emitter + AuthEvents type
│   └── refresh-queue.ts           ← RefreshQueue + RetryTracker
├── token/
│   ├── token-manager.ts           ← header/cookie mode abstraction, token persistence
│   └── jwt-utils.ts               ← decodeJwt, isTokenExpired, getUserIdFromToken
├── http/
│   ├── fetch.adapter.ts           ← FetchAdapter (default)
│   └── axios.adapter.ts           ← createAxiosAdapter(yourInstance)
├── storage/
│   ├── memory.storage.ts          ← MemoryStorage (default)
│   ├── local.storage.ts           ← LocalStorageAdapter
│   ├── session.storage.ts         ← SessionStorageAdapter
│   └── cookie.storage.ts          ← CookieStorageAdapter (non-HttpOnly)
├── types/
│   ├── auth.types.ts              ← AuthStatus, ClientSession, AuthError
│   └── config.types.ts            ← AuthClientConfig, StorageAdapter, HttpAdapter, RequestOptions
└── utils/
    └── role-utils.ts              ← hasRole, hasPermission, hasAnyAccess, hasAllAccess
```

## Public exports

`new AuthClient(config: AuthClientConfig)` is the entry point. Notable fields on the config:

- `baseUrl` (required)
- `endpoints?` — override individual endpoint paths if your backend mounts auth under a non-default prefix
- `accessTokenType?: 'header' | 'cookie' | null` — `null` means auto-detect via `x-access-token-type` header
- `storage?: StorageAdapter` — default `MemoryStorage`
- `httpAdapter?: HttpAdapter` — default `FetchAdapter`
- `autoRefresh?: boolean` — default `true`
- `refreshThreshold?: number` — seconds before expiry, default `60`
- `trustDeviceHeaderName?: string` — default `'nest_auth_device_trust'`
- `onTokenRefreshed`, `onLogout`, `onError` — convenience callbacks

`DEFAULT_ENDPOINTS` — exported map of every endpoint URL the client uses. Don't typo a path; reference these.

## Conventions

- **No new peer deps.** This is the contract: install-and-use, no transitive surprises.
- **Async-safe storage adapters.** Every storage method may return a promise; callers always `await`.
- **Don't expose refresh tokens.** `getRefreshToken()` is internal-only — no public API for getting them out of storage.
- **Idempotent event emission.** Subscribers may run more than once if storage rehydrates on init; they must tolerate it.
- **basePath agnostic.** This package never assumes a path prefix. Server-side wiring of basePath is the consumer's job.

## When you change a method

1. Update `AuthClient` in `src/client/auth-client.ts`.
2. If the method maps to a new endpoint, add it to `DEFAULT_ENDPOINTS` and update `EndpointConfig` in `src/types/config.types.ts`.
3. If types change, update `@ackplus/nest-auth-contracts` first (the request/response DTOs live there). This package re-exports from contracts.
4. Update the docs page at `apps/docs/content/docs/client/client.mdx` (method tables) and the matching React hook in `@ackplus/nest-auth-react` if applicable.

## Adding a storage adapter

Implement the `StorageAdapter` interface from `src/types/config.types.ts`:

```ts
{
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}
```

Sync or async — both are fine. The library awaits everything.

## Adding an HTTP adapter

Implement `HttpAdapter` from `src/types/config.types.ts`. The contract: take an `HttpRequestOptions`, return a normalized `HttpResponse<T>`. JSON serialization is the adapter's job.

## Build

`tsup`, ESM-only output (`dist/index.js`). The `package.json` `type: "module"` is intentional — Node 18+ ESM consumers, browsers via bundlers.

## Docs

https://ack-solutions.github.io/nest-auth/docs/client
