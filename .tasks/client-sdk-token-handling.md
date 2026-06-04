---
id: client-sdk-token-handling
priority: P0
area: client-sdk
status: design
package: '@ackplus/nest-auth-client'
title: Client SDK token-in-request — proper architecture (replaces the user's patch)
---

## Summary

Today, when a consumer app wants to use the nest-auth access token to call **their own** backend (or any third-party API), there's no clean built-in way. The community workaround is to patch around it — manually setting `axios.defaults.headers.common.Authorization` in an `onTokensSet` callback, or polling `useAccessToken()` and copying it to axios on every change. Both are fragile.

This doc defines the proper architecture, identifies why the current code forces a patch, and adds tasks to fix it before v2.0 ships.

---

## The actual problems with today's code

I traced the flow in `packages/nest-auth-client/src/` and `packages/nest-auth-react/src/`. There are **six specific defects** that together force consumers to patch:

| # | Defect | Where | Effect |
|---|---|---|---|
| 1 | Token read is always async (storage is a Promise-returning interface) | `token-manager.ts:111-125` | No sync path for global interceptors that need a value NOW |
| 2 | `useAccessToken()` returns `null` on first render | `nest-auth-react/src/hooks/use-access-token.ts:33-55` | Requests made during initial render skip the header |
| 3 | `useAccessToken()` re-renders consumers on every token change | same | Components doing `<Header token={accessToken} />` rebuild whenever token refreshes |
| 4 | `onTokensSet` / `onTokensRemoved` are the ONLY sync points to external HTTP clients | `auth-provider.tsx:51-54, 137-150` | Forces consumer to mutate axios state imperatively — patch territory |
| 5 | `getAccessToken()` returns `null` in cookie mode | `token-manager.ts:111-115` | Consumer can't reuse the same auth context for their own header-mode service-to-service calls |
| 6 | No "attach to axios / fetch" helper | nowhere | Every consumer reinvents the same interceptor wiring |

The patches in the wild address #4 imperatively, but on **token refresh** the consumer's axios instance also has to be updated — that's a second patch. Then on **logout**, a third patch. Then SSR has its own problem. The patch surface grows.

---

## The right design — 4 stable APIs

### API 1 — `authClient.getAuthHeaders()` (sync where possible)

Single source of truth for "what headers should go on a request right now."

```ts
// Returns the headers nest-auth would attach. Suitable for axios/fetch interceptors.
authClient.getAuthHeaders(): Promise<Record<string, string>>
// → { Authorization: 'Bearer eyJ...', 'x-access-token-type': 'header' }
// or { 'x-access-token-type': 'cookie' } in cookie mode

// Sync variant — reads from in-memory cache (populated by every set/refresh).
// Returns null if not initialized; falls back to async path.
authClient.getAuthHeadersSync(): Record<string, string> | null
```

The async version exists for the rare case where storage isn't pre-cached. The sync version is what 99% of interceptors will use.

**Implementation:** `TokenManager` maintains an **in-memory mirror** of the access token alongside storage. Storage is the durable source; the in-memory mirror is the read path. Every `setTokens` / `clearTokens` / refresh updates both atomically.

### API 2 — `authClient.attachTo(httpClient, opts)` (one-liner integration)

A built-in helper that wires up a consumer-supplied HTTP client (axios instance, ky instance, custom) with two interceptors:

- **Request interceptor:** `headers = { ...request.headers, ...authClient.getAuthHeadersSync() }`
- **Response interceptor:** on 401, call `authClient.refresh()` then retry. Uses the existing `RefreshQueue` so consumer's burst of 401s also dedupes.

```ts
// Consumer code — one line replaces the patch.
authClient.attachToAxios(myAxiosInstance, {
  retryOn401: true,
  skipPaths: ['/auth/refresh', '/public/*'],
});

authClient.attachToFetch(myFetchWrapper, { /* same options */ });
```

Internally `attachToAxios` looks like:

```ts
attachToAxios(instance, opts) {
  const reqId = instance.interceptors.request.use(async (config) => {
    if (opts.skipPaths?.some(p => matchPath(config.url, p))) return config;
    const headers = await this.getAuthHeaders();
    config.headers = { ...config.headers, ...headers };
    if (this.tokenManager.isCookieMode()) config.withCredentials = true;
    return config;
  });

  const resId = instance.interceptors.response.use(
    r => r,
    async (error) => {
      if (error.response?.status !== 401 || !opts.retryOn401) throw error;
      await this.refresh();                     // dedupes via RefreshQueue
      const headers = await this.getAuthHeaders();
      error.config.headers = { ...error.config.headers, ...headers };
      return instance.request(error.config);
    }
  );

  return () => {
    instance.interceptors.request.eject(reqId);
    instance.interceptors.response.eject(resId);
  };
}
```

Returns an unsubscribe function for cleanup on logout/unmount.

### API 3 — `authClient.tokenState` (observable for advanced cases)

For consumers who need to react to token changes outside the React tree (analytics, web workers, service workers, native bridges):

```ts
type TokenState = { accessToken: string | null; mode: 'header' | 'cookie'; expiresAt: Date | null };

authClient.tokenState.get(): TokenState
authClient.tokenState.subscribe(fn: (state: TokenState) => void): () => void
```

Wraps the existing event emitter into a clean state-store API. Same underlying source of truth as #1 and #2.

### API 4 — React hook: `useAuthHeaderFn()` (stable reference)

Solves defects #2 and #3 — initial-render null + re-render churn:

```tsx
// In a fetch wrapper component
function useAuthFetch() {
  const getHeaders = useAuthHeaderFn();  // STABLE function ref across renders
  return useCallback(async (url, init) => {
    return fetch(url, { ...init, headers: { ...init?.headers, ...(await getHeaders()) } });
  }, [getHeaders]);
}
```

`useAuthHeaderFn` returns a `useCallback`-wrapped function that, when called, reads the current token from the client's in-memory mirror. The function ref is stable across renders (only changes if `client` itself changes), so components that hold it as a prop or in deps don't re-render on token refresh.

This is the modern React pattern: **give consumers a way to read state without subscribing to it.**

---

## What changes from today

| Today | After this refactor |
|---|---|
| Consumer must call `onTokensSet`, mutate axios defaults manually, do same on `onTokenRefreshed` and `onTokensRemoved` | `authClient.attachToAxios(instance)` — one line, handles refresh + clear |
| `useAccessToken()` is async, re-renders on every change | `useAuthHeaderFn()` returns stable function; component doesn't re-render |
| Cookie mode → no way to read token at all | Sync API returns the cookie-mode headers (`x-access-token-type`, omit `Authorization`) and helper sets `credentials: 'include'` |
| Token reads always hit storage (Promise) | In-memory mirror; storage is the write-through path |
| Consumer must remember to clean up on logout | `attachTo*` returns unsubscribe function; provider auto-calls it |
| `onTokensSet` / `onTokensRemoved` are the public extension points | They become **internal** — kept for backward compat in v2.0 with deprecation, removed in v3 |

---

## How this lands

These get added to the task tracker as part of Phase 7 (Client SDK Quality), but **brought forward** because the user has hit this directly and we're shipping a major bump. They are P0 for the v2.0 release.

| New ID | Task | Effort |
|---|---|---|
| T-167a | Implement in-memory token mirror in `TokenManager` (write-through to storage; sync read API) | S |
| T-167b | Add `AuthClient.getAuthHeaders()` (async) and `getAuthHeadersSync()` (sync) — single source of truth for outgoing request decoration | S |
| T-167c | Add `AuthClient.attachToAxios()` and `AuthClient.attachToFetch()` helpers with auto-401-refresh and unsubscribe handles | M |
| T-167d | Add `AuthClient.tokenState` observable (get + subscribe) wrapping the existing event emitter | XS |
| T-178a | Add React hook `useAuthHeaderFn()` returning stable function ref; document migration from `useAccessToken()` | S |
| T-178b | Deprecate `onTokensSet`/`onTokensRemoved` provider props with console.warn pointing at new helpers; remove in v3 | XS |
| T-178c | Update `apps/example-react` and `apps/example-next` to use the new attach helpers (proves the design) | S |

---

## Test coverage (real tests, no mocks)

Per the no-mock policy, all token-handling tests boot a real backend and a real axios/fetch:

| TC ID | Test | Type |
|---|---|---|
| TC-NEW-token-1 | `attachToAxios` adds Authorization header to outgoing request | integration (real backend) |
| TC-NEW-token-2 | `attachToAxios` retries once on 401 after refresh | integration |
| TC-NEW-token-3 | 10 concurrent requests + 1 401 → 1 refresh, all 10 retried with new token | integration |
| TC-NEW-token-4 | `attachToAxios` unsubscribe handler removes interceptors cleanly | integration |
| TC-NEW-token-5 | Cookie mode: `attachToAxios` sets `withCredentials: true`, no Authorization header | integration |
| TC-NEW-token-6 | `getAuthHeadersSync()` returns current token immediately after login (no async wait) | integration |
| TC-NEW-token-7 | `useAuthHeaderFn` function ref is stable across token refreshes (React test) | component |
| TC-NEW-token-8 | Component using `useAuthHeaderFn` does NOT re-render when token refreshes | component (perf) |
| TC-NEW-token-9 | SSR: `attachToFetch` on a Node fetch wrapper attaches token from server-side context | integration (Next.js) |

---

## Migration story

Documented in [`migration-v1-to-v2.md`](migration-v1-to-v2.md) under **Client SDK migration → Token integration**. Old pattern:

```tsx
// OLD (the patch the user wrote)
<AuthProvider client={client} onTokensSet={({ accessToken }) => {
  axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
}} onTokensRemoved={() => {
  delete axios.defaults.headers.common.Authorization;
}}>
```

New pattern (single line, all flows handled including refresh + logout + cookie mode):

```tsx
// NEW
useEffect(() => authClient.attachToAxios(myAxios), [authClient]);
```

---

## Related

- [`000-master-roadmap.md`](000-master-roadmap.md) §3 — Plugin architecture (this client-side work mirrors the server-side single-source-of-truth principle)
- [`cross-system-sync.md`](cross-system-sync.md) — same "single source of truth" pattern applied to the server's event/hook layer
- [`migration-v1-to-v2.md`](migration-v1-to-v2.md) §"Client SDK migration" — consumer-facing upgrade guide
- [`task-tracker.md`](task-tracker.md) — T-167a-d, T-178a-c
