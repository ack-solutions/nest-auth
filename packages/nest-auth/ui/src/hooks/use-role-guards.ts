import { useMemo } from 'react';
import { useClientConfig } from './use-client-config';

const GUARDS_HELPER_TEXT =
    'Guards are configured server-side. To add a new guard, set roleGuards in NestAuthModule.forRoot() (e.g. in app.module.ts).';

export function useRoleGuards(): {
    roleGuards: string[];
    loading: boolean;
    error: string | null;
    guardOptions: Array<{ value: string; label: string }>;
    helperText: string;
} {
    const { roleGuards, loading, error } = useClientConfig();
    const guardOptions = useMemo(
        () => roleGuards.map((g) => ({ value: g, label: g })),
        [roleGuards],
    );
    return {
        roleGuards,
        loading,
        error,
        guardOptions,
        helperText: GUARDS_HELPER_TEXT,
    };
}
