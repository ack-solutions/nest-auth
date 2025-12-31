/**
 * Gets the base URL for the auth admin console API.
 * Priority:
 * 1. Environment variable VITE_API_BASE_URL (origin only, useful for dev with different server)
 * 2. Server-injected config (production)
 * 3. Current location origin + default basePath (default)
 */
export const getAdminApiBaseUrl = (): string => {
    // Check for server-injected config (production)
    const serverBasePath = window.__NEST_AUTH_CONFIG__?.basePath;
    const serverApiUrl = window.__NEST_AUTH_CONFIG__?.apiUrl;
    if (serverApiUrl) {
        return serverApiUrl;
    }

    // Check for custom origin from environment (dev mode)
    const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const origin = envBaseUrl ? envBaseUrl.replace(/\/$/, '') : window.location.origin;
    const basePath = serverBasePath ?? '/api/auth/admin';

    return `${origin}${basePath}`;
};
