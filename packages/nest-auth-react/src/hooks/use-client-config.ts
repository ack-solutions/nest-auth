"use client";

/**
 * useClientConfig — fetch the backend's PUBLIC client configuration once and
 * cache it, so UI can adapt to the backend setup (tenant mode, email/phone/
 * passwordless, OAuth client ids, registration/MFA, platform access, and
 * `multipleAccounts.enabled`).
 *
 * Common use: decide whether to render the multi-account switcher.
 *
 * ```tsx
 * const { config, isLoading } = useClientConfig();
 * if (config?.multipleAccounts?.enabled) return <AccountSwitcher />;
 * ```
 *
 * Uses the AuthProvider's client. For a standalone fetch (e.g. before any
 * provider mounts), call `new AuthClient({ baseUrl }).getClientConfig()` directly.
 */
import { useEffect, useState } from 'react';
import type { IClientConfig } from '@ackplus/nest-auth-client';
import { useNestAuth } from './use-auth';

export interface UseClientConfigResult {
    config: IClientConfig | null;
    isLoading: boolean;
    error: Error | null;
    /** Re-fetch the client config. */
    refresh: () => Promise<void>;
}

export function useClientConfig(): UseClientConfigResult {
    const { client } = useNestAuth();
    const [config, setConfig] = useState<IClientConfig | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const load = async () => {
        if (!client) return;
        setIsLoading(true);
        setError(null);
        try {
            setConfig(await client.getClientConfig());
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        (async () => {
            if (!client) return;
            try {
                const cfg = await client.getClientConfig();
                if (active) setConfig(cfg);
            } catch (e) {
                if (active) setError(e instanceof Error ? e : new Error(String(e)));
            } finally {
                if (active) setIsLoading(false);
            }
        })();
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

    return { config, isLoading, error, refresh: load };
}

/** Convenience: whether the backend has multi-account login enabled (null while loading). */
export function useMultiAccountEnabled(): boolean | null {
    const { config, isLoading } = useClientConfig();
    if (isLoading && !config) return null;
    return config?.multipleAccounts?.enabled ?? false;
}
