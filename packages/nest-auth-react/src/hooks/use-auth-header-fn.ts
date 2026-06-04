"use client";

/**
 * useAuthHeaderFn hook — returns a STABLE function reference that, when called,
 * returns the current auth headers. The function does NOT re-render its consumer
 * when the token changes.
 *
 * This is the recommended hook for request-decoration use cases:
 *   - Custom fetch wrappers
 *   - Form submit handlers that include auth
 *   - Anywhere you'd previously have used `useAccessToken()` and a `useEffect`
 *
 * For pure render-time display (e.g. a debug panel showing the current token),
 * use `useTokenState()` (T-178b) which IS reactive.
 *
 * Replaces the v1 patch pattern where consumers manually wired `onTokensSet`
 * into a global axios instance. See .tasks/client-sdk-token-handling.md.
 */

import { useCallback, useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import type { GetAuthHeadersOptions } from '@ackplus/nest-auth-client';

/**
 * Returns a stable function that, when called, returns the current auth headers
 * (async, hits the in-memory mirror first for low latency).
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const getAuthHeaders = useAuthHeaderFn();
 *
 *   const submit = async (data: FormData) => {
 *     await fetch('/api/submit', {
 *       method: 'POST',
 *       headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
 *       body: JSON.stringify(data),
 *     });
 *   };
 *
 *   return <button onClick={() => submit(...)}>Submit</button>;
 *   // Note: this component does NOT re-render when the token refreshes.
 * }
 * ```
 */
export function useAuthHeaderFn(opts?: GetAuthHeadersOptions): () => Promise<Record<string, string>> {
    const context = useContext(AuthContext);

    // The returned function is stable as long as `context.client` is stable.
    // Token changes do NOT recreate this function — that's the whole point.
    return useCallback(async () => {
        if (!context.client) return {};
        return context.client.getAuthHeaders(opts);
    }, [context.client, opts?.authHeaderName, opts?.trustHeaderName, opts?.skipAuthHeader, opts?.includeTrustToken, opts?.includeAccessTokenTypeHeader]);
}

/**
 * Sync variant — returns a stable function returning the headers synchronously
 * from the in-memory mirror.
 *
 * Use this when you need headers in a sync context (axios.interceptors.request
 * is one — though prefer `client.attachToAxios()` for that). Returns `{}` if
 * the token mirror is empty (no login yet or warm-up pending).
 */
export function useAuthHeaderFnSync(opts?: GetAuthHeadersOptions): () => Record<string, string> {
    const context = useContext(AuthContext);

    return useCallback(() => {
        if (!context.client) return {};
        return context.client.getAuthHeadersSync(opts);
    }, [context.client, opts?.authHeaderName, opts?.trustHeaderName, opts?.skipAuthHeader, opts?.includeTrustToken, opts?.includeAccessTokenTypeHeader]);
}
