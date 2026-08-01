import { getAdminApiBaseUrl } from "@/components/auth/utils/utils";

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Global config injected by the server
declare global {
    interface Window {
        __NEST_AUTH_CONFIG__?: {
            basePath: string;
            apiUrl?: string;
        };
    }
}


interface RequestOptions extends RequestInit {
    body?: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Default double-submit CSRF cookie name (matches the server's CSRF_COOKIE_NAME).
const CSRF_COOKIE_NAME = 'nest_auth_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

/** Read a non-httpOnly cookie value by name (used for the CSRF double-submit token). */
function readCookie(name: string): string | undefined {
    if (typeof document === 'undefined' || !document.cookie) return undefined;
    for (const part of document.cookie.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) {
            return decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return undefined;
}

interface ApiService {
    basePath: string;
    request<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    get<T>(endpoint: string): Promise<T>;
    post<T>(endpoint: string, data: any): Promise<T>;
    patch<T>(endpoint: string, data: any): Promise<T>;
    delete<T>(endpoint: string): Promise<T>;
}

export const api: ApiService = {
    get basePath() {
        return getAdminApiBaseUrl();
    },

    async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const normalizedBase = this.basePath && this.basePath !== '/' ? this.basePath : '';
        const url = `${normalizedBase}${endpoint}`;

        const fetchOptions: RequestInit = {
            credentials: 'include',
            ...options,
        };

        // Normalize headers into a Headers object so we can add Content-Type and
        // the CSRF token without clobbering any caller-provided headers.
        const headers = new Headers(options.headers as HeadersInit | undefined);
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        // Echo the double-submit CSRF token on state-changing requests. The admin
        // console authenticates by cookie, so the server (when CSRF is enabled)
        // requires the token from the non-httpOnly CSRF cookie to be echoed here.
        // A no-op when CSRF is disabled (no cookie present).
        const method = (options.method || 'GET').toUpperCase();
        if (!SAFE_METHODS.has(method)) {
            const csrf = readCookie(CSRF_COOKIE_NAME);
            if (csrf) headers.set(CSRF_HEADER_NAME, csrf);
        }
        fetchOptions.headers = headers;

        const response = await fetch(url, fetchOptions);
        const text = await response.text().catch((err) => {
            console.warn('Failed to read response text:', err, 'Status:', response.status);
            return '';
        });

        let payload: any = {};
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (error) {
                console.warn(
                    'Failed to parse JSON response:',
                    error,
                    'Status:',
                    response.status,
                    'Response text:',
                    text.substring(0, 200)
                );
            }
        }

        if (!response.ok) {
            const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
            throw new ApiError(message, response.status);
        }

        return payload as T;
    },

    get<T>(this: ApiService, endpoint: string) {
        return this.request<T>(endpoint);
    },

    post<T>(this: ApiService, endpoint: string, data: any) {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    patch<T>(this: ApiService, endpoint: string, data: any) {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete<T>(this: ApiService, endpoint: string) {
        return this.request<T>(endpoint, {
            method: 'DELETE',
        });
    },
};
