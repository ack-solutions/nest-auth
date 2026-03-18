import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { UserDetailView } from '../components/user/user-detail-view';
import { getAuthApiBaseUrl } from '../components/auth/utils/utils';
import { api } from '../services/api';
import type { UserDetails, Role, Tenant } from '../types';

export type TenantMode = 'isolated' | 'shared' | null;

export const UserDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [tenantMode, setTenantMode] = useState<TenantMode>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadUserDetails = useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.get<UserDetails>(`/api/users/${id}`);
            setUserDetails(data);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load user');
            setUserDetails(null);
        }
    }, [id]);

    const loadConfig = useCallback(async () => {
        try {
            const authBase = getAuthApiBaseUrl();
            const res = await fetch(`${authBase}/client-config`, { credentials: 'include' });
            if (!res.ok) return;
            const config = await res.json()
            setTenantMode(config.tenants?.mode ?? null);
        } catch {
            setTenantMode(null);
        }
    }, []);

    useEffect(() => {
        if (!id) {
            navigate('/users', { replace: true });
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                await loadUserDetails();
                await loadConfig();
                const [rolesRes, tenantsRes] = await Promise.all([
                    api.get<{ data: Role[] }>('/api/roles'),
                    api.get<{ data: Tenant[] }>('/api/tenants'),
                ]);
                setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
                setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, loadUserDetails, loadConfig, navigate]);

    const handleUpdate = async (
        userId: string,
        updates: Partial<import('../types').User> & {
            tenantIds?: string[];
            tenantRoles?: { tenantId: string; roleIds: string[] }[];
        }
    ) => {
        await api.patch(`/api/users/${userId}`, updates);
        await loadUserDetails();
    };

    const handleBack = () => navigate('/users');

    if (!id) return null;

    if (loading && !userDetails) {
        return (
            <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 8 }}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="text.secondary">Loading user...</Typography>
            </Stack>
        );
    }

    if (error || !userDetails) {
        return (
            <PageHeader
                title="User"
                description={error || 'User not found'}
                onRefresh={loadUserDetails}
                action={
                    <Button variant="outlined" color="inherit" onClick={handleBack} startIcon={<ArrowLeft style={{ width: 18, height: 18 }} />}>
                        Back to users
                    </Button>
                }
            />
        );
    }

    return (
        <Stack spacing={2}>
            <PageHeader
                title={userDetails.user.email}
                description="User details & management"
                onRefresh={loadUserDetails}
                action={
                    <Button variant="outlined" color="inherit" onClick={handleBack} startIcon={<ArrowLeft style={{ width: 18, height: 18 }} />}>
                        Back to users
                    </Button>
                }
            />
            <UserDetailView
                userDetails={userDetails}
                roles={roles}
                tenants={tenants}
                tenantMode={tenantMode}
                onUpdate={handleUpdate}
                onRefresh={loadUserDetails}
            />
        </Stack>
    );
};
