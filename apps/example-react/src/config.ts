export const config = {
    /**
     * Origin only (no /api suffix).
     * Examples:
     * - http://localhost:3333
     * - https://api.yourdomain.com
     */
    apiBaseOrigin: import.meta.env.VITE_API_BASE_URL as string | undefined,
};

