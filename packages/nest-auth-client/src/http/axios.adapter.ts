/**
 * Axios-based HTTP adapter (optional)
 * Use this if you prefer axios or need its features
 */

import { HttpAdapter, HttpRequestOptions, HttpResponse } from '../types/config.types';

/**
 * Create an Axios HTTP adapter
 * 
 * This is an optional adapter for users who prefer axios.
 * The axios instance must be provided by the user.
 * 
 * @example
 * ```typescript
 * import axios from 'axios';
 * import { createAxiosAdapter } from '@ackplus/nest-auth-client';
 * 
 * const axiosInstance = axios.create({ baseURL: 'http://localhost:3000' });
 * const httpAdapter = createAxiosAdapter(axiosInstance);
 * 
 * const client = new AuthClient({
 *   baseUrl: 'http://localhost:3000',
 *   httpAdapter,
 * });
 * ```
 */
export function createAxiosAdapter(axiosInstance: any): HttpAdapter {
    return {
        async request<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
            const { url, method, headers = {}, body, credentials, timeout, signal } = options;

            try {
                const response = await axiosInstance.request({
                    url,
                    method: method.toLowerCase(),
                    headers,
                    data: body,
                    withCredentials: credentials === 'include',
                    timeout,
                    signal,
                });

                // Convert axios headers to plain object
                const responseHeaders: Record<string, string> = {};
                if (response.headers) {
                    if (typeof response.headers.forEach === 'function') {
                        response.headers.forEach((value: string, key: string) => {
                            responseHeaders[key.toLowerCase()] = value;
                        });
                    } else {
                        Object.entries(response.headers).forEach(([key, value]) => {
                            responseHeaders[key.toLowerCase()] = String(value);
                        });
                    }
                }

                return {
                    status: response.status,
                    data: response.data,
                    headers: responseHeaders,
                    ok: response.status >= 200 && response.status < 300,
                };
            } catch (error: any) {
                // Handle axios errors
                if (error.response) {
                    const responseHeaders: Record<string, string> = {};
                    if (error.response.headers) {
                        Object.entries(error.response.headers).forEach(([key, value]) => {
                            responseHeaders[key.toLowerCase()] = String(value);
                        });
                    }

                    return {
                        status: error.response.status,
                        data: error.response.data,
                        headers: responseHeaders,
                        ok: false,
                    };
                }

                // Network error or timeout
                throw error;
            }
        },
    };
}
