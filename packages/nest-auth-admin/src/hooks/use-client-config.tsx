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
    /** Whether the platform-admin login path is configured (`platformAccess.enabled`). */
    platformAccess?: { enabled: boolean };
}

interface ClientConfigContextValue {
    config: ClientConfigState | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    roleGuards: string[];
    tenantMode: TenantMode;
    tenantEnabled: boolean;
    /** Platform access scope is configured on the backend — show platform UI. */
    platformAccessEnabled: boolean;
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
            if (!res.ok) throw new Error(`GET ${authBase}/client-config → ${res.status}`);
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
                platformAccess: data.platformAccess,
            };
            setConfig(normalized);
        } catch (err: any) {
            // Surface this loudly: a failed client-config load is exactly what
            // hides the Tenants module, tenant columns/filters, and the role-guard
            // options — so a silent fallback to empty config looks like "the admin
            // UI is broken". Log the resolved URL so the cause (wrong base path /
            // global prefix / 404) is obvious in the console.
            console.warn(
                `[nest-auth admin] Could not load /client-config — Tenants and role-guard ` +
                `filters will be hidden. ${err?.message ?? err}`,
            );
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
        // Tenant UI is ON whenever a tenant mode is resolved (i.e. tenants aren't
        // explicitly disabled) — ONE signal for the nav, columns, filters, and
        // detail page. Deriving this from `tenants.enabled === true` alone was
        // inconsistent with the rest of the UI (which keys off tenantMode): an app
        // that set `tenant.mode` without `tenant.enabled: true` got the Tenants nav
        // hidden while the user-list tenant column still showed.
        tenantEnabled: (config?.tenantMode ?? null) !== null,
        platformAccessEnabled: config?.platformAccess?.enabled === true,
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
