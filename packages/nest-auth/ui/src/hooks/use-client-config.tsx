import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthApiBaseUrl } from '../components/auth/utils/utils';

export type TenantMode = 'isolated' | 'shared' | null;

export interface ClientConfigState {
    roleGuards: string[];
    tenantMode: TenantMode;
    tenants?: { enabled?: boolean; mode?: string };
    emailAuth?: { enabled: boolean };
    phoneAuth?: { enabled: boolean };
    registration?: { enabled: boolean; requireInvitation?: boolean };
    mfa?: { enabled: boolean; methods?: string[]; allowUserToggle?: boolean; allowMethodSelection?: boolean };
}

interface ClientConfigContextValue {
    config: ClientConfigState | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    roleGuards: string[];
    tenantMode: TenantMode;
    tenantEnabled: boolean;
}

const defaultState: ClientConfigState = {
    roleGuards: [],
    tenantMode: null,
};

const ClientConfigContext = createContext<ClientConfigContextValue | null>(null);

export function ClientConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<ClientConfigState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const authBase = getAuthApiBaseUrl();
            const res = await fetch(`${authBase}/client-config`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to load config');
            const data = await res.json();

            // If tenants are explicitly disabled from the backend, treat tenant UI as off.
            const tenantsEnabled = data.tenants?.enabled;
            const resolvedTenantMode: TenantMode = tenantsEnabled === false ? null : ((data.tenants?.mode ?? data.tenantMode ?? null) as TenantMode);

            const normalized: ClientConfigState = {
                roleGuards: Array.isArray(data.roleGuards) ? data.roleGuards : [],
                tenantMode: resolvedTenantMode,
                tenants: data.tenants,
                emailAuth: data.emailAuth,
                phoneAuth: data.phoneAuth,
                registration: data.registration,
                mfa: data.mfa,
            };
            setConfig(normalized);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load config');
            setConfig(defaultState);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const value: ClientConfigContextValue = {
        config,
        loading,
        error,
        refetch: fetchConfig,
        roleGuards: config?.roleGuards ?? [],
        tenantMode: config?.tenantMode ?? null,
        tenantEnabled: config?.tenants?.enabled ?? false,
    };

    return (
        <ClientConfigContext.Provider value={value}>
            {children}
        </ClientConfigContext.Provider>
    );
}

export function useClientConfig(): ClientConfigContextValue {
    const ctx = useContext(ClientConfigContext);
    if (!ctx) {
        throw new Error('useClientConfig must be used within ClientConfigProvider');
    }
    return ctx;
}
