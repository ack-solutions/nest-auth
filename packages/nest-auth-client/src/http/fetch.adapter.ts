/**
 * Fetch-based HTTP adapter
 * Works in browser and Node 18+
 */

import { HttpAdapter, HttpRequestOptions, HttpResponse } from '../types/config.types';

/**
 * HTTP adapter using the Fetch API
 * 
 * This is the default HTTP adapter and works in:
 * - All modern browsers
 * - Node.js 18+ (native fetch)
 * - React Native
 * - Cloudflare Workers, Deno, Bun
 */
export class FetchAdapter implements HttpAdapter {
    /**
     * Make an HTTP request using fetch
     */
    async request<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
        const { url, method, headers = {}, body, credentials = 'same-origin', timeout, signal } = options;

        // Setup timeout if specified
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let abortController: AbortController | undefined;

        if (timeout && !signal) {
            abortController = new AbortController();
            timeoutId = setTimeout(() => abortController?.abort(), timeout);
        }

        try {
            const fetchOptions: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                credentials,
                signal: signal || abortController?.signal,
            };

            if (body && method !== 'GET') {
                fetchOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);

            // Parse response headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key.toLowerCase()] = value;
            });

            // Parse response body
            let data: T;
            const contentType = responseHeaders['content-type'] || '';

            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text() as any;
            }

            return {
                status: response.status,
                data,
                headers: responseHeaders,
                ok: response.ok,
            };
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}
