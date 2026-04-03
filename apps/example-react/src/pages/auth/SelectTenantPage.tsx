/**
 * Tenant selection page (SHARED mode)
 * When the backend allows login without an active tenant, the client must call
 * `/auth/switch-tenant` after the user selects one, so the session reflects the active tenant.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import AuthCard from '../../components/AuthCard';
import { useAuth } from '../../context/use-auth';

export default function SelectTenantPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const {  switchTenant, isLoading, status } = useAuth();

    const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

    const tenantOptions = useMemo(() => {
        return []
    }, []);

    const defaultTenantId = useMemo(() => {
        return '';
    }, []);

    const [selectedTenantId, setSelectedTenantId] = useState<string>(defaultTenantId ?? '');
    const [error, setError] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);

    const needsTenantSelection = false;

    useEffect(() => {
        if (status === 'loading') return;
        if (!needsTenantSelection) {
            navigate(fromPath, { replace: true });
        }
    }, [needsTenantSelection, navigate, fromPath, status]);

    useEffect(() => {
        // If memberships loaded after initial render, ensure we have a selection.
        if (!selectedTenantId && defaultTenantId) {
            setSelectedTenantId(defaultTenantId);
        }
    }, [selectedTenantId, defaultTenantId]);

    if (!needsTenantSelection) return null;

    const onContinue = async () => {
        setError(null);
        if (!selectedTenantId) {
            setError('Please select a tenant.');
            return;
        }
        setSwitching(true);
        try {
            await switchTenant({ tenantId: selectedTenantId } as any);
            navigate(fromPath, { replace: true });
        } catch (e: any) {
            setError(e?.message ?? 'Failed to switch tenant.');
        } finally {
            setSwitching(false);
        }
    };

    return (
        <AuthCard
            title="Select workspace"
            subtitle="Choose which tenant you want to use for this session."
        >
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {!tenantOptions.length ? (
                <Typography variant="body2" color="text.secondary">
                    No tenant memberships found for your account.
                </Typography>
            ) : (
                <Box sx={{ mt: 1 }}>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel id="tenant-select-label">Tenant</InputLabel>
                        <Select
                            labelId="tenant-select-label"
                            value={selectedTenantId}
                            label="Tenant"
                            onChange={(e) => setSelectedTenantId(String(e.target.value))}
                            disabled={switching || isLoading}
                        >
                            {tenantOptions.map((t) => (
                                <MenuItem key={t.id} value={t.id}>
                                    {t.name}
                                    {t.isDefault ? ' (default)' : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={() => void onContinue()}
                        disabled={switching || isLoading}
                        sx={{ mt: 3, mb: 1, height: 48 }}
                    >
                        {switching ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
                    </Button>
                </Box>
            )}
        </AuthCard>
    );
}

