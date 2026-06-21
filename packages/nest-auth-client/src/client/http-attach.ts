/**
 * HTTP-client attach helpers (T-167c).
 *
 * Lets a consumer wire their own axios instance or fetch wrapper to share auth
 * state with an `AuthClient`. Replaces the manual `onTokensSet` patch pattern
 * documented in .tasks/client-sdk-token-handling.md.
 *
 * We don't take a hard dependency on `axios` — instead we type the parameter
 * with the minimal `AxiosLike` interface so any compatible client works
 * (axios, redaxios, etc.).
 */

import type { GetAuthHeadersOptions } from '../types/config.types';

/**
 * Minimal auth surface the attach helpers need. Implemented by {@link AuthClient}
 * AND by the multi-account managers (`AccountManager` / `CookieAccountManager`),
 * which delegate to whichever account is currently active. Attaching to a manager
 * means a single shared axios/fetch instance always uses the ACTIVE account's
 * bearer with no re-attach on switch.
 */
export interface AuthHeaderProvider {
  getAuthHeaders(opts?: GetAuthHeadersOptions): Promise<Record<string, string>>;
  shouldSendCookies(): boolean;
  refresh(...args: any[]): Promise<unknown>;
}

// ─── Minimal axios-shape (structural) ─────────────────────────────────────────

interface AxiosLikeInterceptorManager<V> {
  use(
    onFulfilled?: ((value: V) => V | Promise<V>) | null,
    onRejected?: ((error: any) => any) | null,
  ): number;
  eject(id: number): void;
}

interface AxiosLikeRequestConfig {
  url?: string;
  headers?: Record<string, string> | { [key: string]: any };
  withCredentials?: boolean;
  [key: string]: any;
}

interface AxiosLikeResponse {
  status: number;
  config: AxiosLikeRequestConfig;
  [key: string]: any;
}

interface AxiosLikeError {
  response?: AxiosLikeResponse;
  config?: AxiosLikeRequestConfig;
  [key: string]: any;
}

/**
 * Minimal shape an `attachToAxios` argument must satisfy. Matches the public
 * surface of an `axios` instance returned by `axios.create()`.
 */
export interface AxiosLikeInstance {
  interceptors: {
    request: AxiosLikeInterceptorManager<AxiosLikeRequestConfig>;
    response: AxiosLikeInterceptorManager<AxiosLikeResponse>;
  };
  /** Re-issue a request with the given config. axios' `instance.request(config)`. */
  request<T = any>(config: AxiosLikeRequestConfig): Promise<T>;
}

// ─── Options ──────────────────────────────────────────────────────────────────

/**
 * Options for `attachToAxios` / `attachToFetch`.
 *
 * Defaults are sensible — most consumers can call with no options.
 */
export interface AttachOptions extends GetAuthHeadersOptions {
  /**
   * Whether to install a response interceptor that retries the request once on
   * 401 after refreshing the token. Default: `true`.
   *
   * Set to `false` if you're using this helper for a third-party API that
   * shouldn't share refresh semantics with your nest-auth backend.
   */
  retryOn401?: boolean;

  /**
   * URLs / path patterns to SKIP — auth headers won't be attached.
   * Useful for public endpoints, login itself, etc.
   *
   * Each entry can be:
   *  - a string (exact-match suffix on the URL)
   *  - a RegExp (tested against the URL)
   *  - a function `(url: string) => boolean`
   *
   * Example: `skipPaths: ['/auth/refresh', /^\/public\//, (u) => u.includes('legacy')]`
   */
  skipPaths?: Array<string | RegExp | ((url: string) => boolean)>;

  /**
   * Called when refresh fails inside the response interceptor (typically because
   * the refresh token itself expired). The consumer can react by redirecting to
   * login, clearing app state, etc. Default: a no-op (the 401 propagates).
   */
  onRefreshFailed?: (error: unknown) => void | Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlMatchesSkip(url: string | undefined, skipPaths?: AttachOptions['skipPaths']): boolean {
  if (!url || !skipPaths || skipPaths.length === 0) return false;
  for (const p of skipPaths) {
    if (typeof p === 'string' && url.endsWith(p)) return true;
    if (p instanceof RegExp && p.test(url)) return true;
    if (typeof p === 'function' && p(url)) return true;
  }
  return false;
}

// ─── attachToAxios ────────────────────────────────────────────────────────────

/**
 * Wire an axios-like instance to share auth state with an `AuthClient`.
 *
 * Installs:
 *   1. A REQUEST interceptor that attaches `getAuthHeaders()` to every outgoing
 *      request (unless its URL matches `skipPaths`).
 *   2. A RESPONSE interceptor that, on 401, calls `authClient.refresh()` once
 *      and retries the original request with new headers.
 *
 * Returns an unsubscribe function — call it from `useEffect` cleanup / logout
 * to detach the interceptors. The same axios instance can be re-attached after.
 *
 * @example
 * ```ts
 * import axios from 'axios';
 * const api = axios.create({ baseURL: '/api' });
 * const unsubscribe = authClient.attachToAxios(api);
 * // ... later:
 * unsubscribe();
 * ```
 *
 * The first argument can be an `AuthClient` OR an account manager
 * (`AccountManager` / `CookieAccountManager`) — anything matching
 * {@link AuthHeaderProvider}. Pass a manager to have the shared instance follow
 * the active account automatically (no re-attach on switch).
 */
export function attachToAxios(
  client: AuthHeaderProvider,
  instance: AxiosLikeInstance,
  opts: AttachOptions = {},
): () => void {
  const reqId = instance.interceptors.request.use(async (config) => {
    if (urlMatchesSkip(config.url, opts.skipPaths)) return config;

    // Async path — handles the very first request when mirror isn't warm yet
    const headers = await client.getAuthHeaders(opts);
    config.headers = { ...(config.headers ?? {}), ...headers };

    if (client.shouldSendCookies()) {
      config.withCredentials = true;
    }
    return config;
  });

  const resId = instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosLikeError) => {
      if (
        opts.retryOn401 === false ||
        error.response?.status !== 401 ||
        !error.config ||
        urlMatchesSkip(error.config.url, opts.skipPaths)
      ) {
        throw error;
      }

      // Tag this config so we only retry once per request — even if multiple
      // 401s happen back-to-back during a quirky refresh, we don't loop.
      const cfg = error.config as AxiosLikeRequestConfig & { __nestAuthRetried?: boolean };
      if (cfg.__nestAuthRetried) throw error;
      cfg.__nestAuthRetried = true;

      try {
        await client.refresh();
      } catch (refreshErr) {
        if (opts.onRefreshFailed) {
          await Promise.resolve(opts.onRefreshFailed(refreshErr));
        }
        throw error;
      }

      const newHeaders = await client.getAuthHeaders(opts);
      cfg.headers = { ...(cfg.headers ?? {}), ...newHeaders };
      return instance.request(cfg);
    },
  );

  return () => {
    instance.interceptors.request.eject(reqId);
    instance.interceptors.response.eject(resId);
  };
}

// ─── attachToFetch ────────────────────────────────────────────────────────────

/**
 * Wraps a `fetch`-like function so every call automatically attaches auth headers
 * and retries once on 401 after refresh.
 *
 * Returns a NEW function with the same signature as `fetch` — call this instead
 * of the original. Unlike `attachToAxios`, there are no global interceptors to
 * eject; cleanup is "stop calling the wrapped function."
 *
 * @example
 * ```ts
 * const myFetch = authClient.attachToFetch(globalThis.fetch);
 * const res = await myFetch('/api/data');
 * ```
 */
export function attachToFetch(
  client: AuthHeaderProvider,
  baseFetch: typeof globalThis.fetch = globalThis.fetch,
  opts: AttachOptions = {},
): typeof globalThis.fetch {
  // Resolve `fetch` once with `this` bound to globalThis (some envs require it)
  const fetchFn = baseFetch.bind(globalThis);

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const isSkipped = urlMatchesSkip(url, opts.skipPaths);

    const buildInit = async (existing: RequestInit): Promise<RequestInit> => {
      if (isSkipped) return existing;

      const headers = await client.getAuthHeaders(opts);
      const merged: RequestInit = {
        ...existing,
        headers: { ...((existing.headers as Record<string, string>) ?? {}), ...headers },
      };
      if (client.shouldSendCookies()) {
        merged.credentials = 'include';
      }
      return merged;
    };

    let response = await fetchFn(input, await buildInit(init));

    if (
      response.status === 401 &&
      opts.retryOn401 !== false &&
      !isSkipped
    ) {
      try {
        await client.refresh();
      } catch (refreshErr) {
        if (opts.onRefreshFailed) {
          await Promise.resolve(opts.onRefreshFailed(refreshErr));
        }
        return response; // return the original 401
      }
      response = await fetchFn(input, await buildInit(init));
    }

    return response;
  };
}
