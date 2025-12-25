/**
 * useAccessToken hook - Access token only (header mode)
 */

import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context';

/**
 * Access the current access token (header mode only)
 * 
 * @returns Current access token or null
 * 
 * @example
 * ```tsx
 * function ApiRequest() {
 *   const accessToken = useAccessToken();
 * 
 *   const fetchData = async () => {
 *     const res = await fetch('/api/data', {
 *       headers: {
 *         Authorization: `Bearer ${accessToken}`,
 *       },
 *     });
 *     return res.json();
 *   };
 * 
 *   // ...
 * }
 * ```
 */
export function useAccessToken(): string | null {
    const context = useContext(AuthContext);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadToken = async () => {
            const accessToken = await context.client?.getAccessToken?.();
            if (mounted) {
                setToken(accessToken ?? null);
            }
        };

        loadToken();

        return () => {
            mounted = false;
        };
    }, [context.client, context.session]);

    return token;
}
