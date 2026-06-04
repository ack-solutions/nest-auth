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

        // Merge headers and ensure Content-Type for JSON bodies without clobbering existing headers
        if (options.body) {
            const existing = options.headers;
            if (existing instanceof Headers) {
                const hasContentType = Array.from(existing.keys()).some((k) => k.toLowerCase() === 'content-type');
                if (!hasContentType) existing.set('Content-Type', 'application/json');
                fetchOptions.headers = existing;
            } else {
                const objHeaders: Record<string, string> = {};
                if (existing) {
                    for (const [k, v] of Object.entries(existing as Record<string, string>)) {
                        objHeaders[k] = v as string;
                    }
                }
                const hasContentType = Object.keys(objHeaders).some((k) => k.toLowerCase() === 'content-type');
                if (!hasContentType) objHeaders['Content-Type'] = 'application/json';
                fetchOptions.headers = objHeaders;
            }
        }

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
